#include "cosmos_engine.hpp"
#include <algorithm>
#include <cmath>

namespace Cosmos {

void NBodySimulator::addBody(uint32_t id, double mass, double radius, const Vector3& pos, const Vector3& vel) {
    bodies.push_back(BodyState{
        .id = id,
        .mass = mass,
        .radius = radius,
        .position = pos,
        .velocity = vel,
        .acceleration = Vector3{0, 0, 0}
    });
}

void NBodySimulator::clear() {
    bodies.clear();
}

void NBodySimulator::setTimeStep(double dt) {
    timeStep = dt;
}

// Compute gravitational accelerations on all bodies
static void computeAccelerations(const std::vector<Vector3>& positions,
                                 const std::vector<double>& masses,
                                 std::vector<Vector3>& outAccels) {
    size_t n = positions.size();
    outAccels.assign(n, Vector3{0, 0, 0});
    constexpr double softening = 1e4; // gravitational softening parameter (m^2)

    for (size_t i = 0; i < n; ++i) {
        for (size_t j = i + 1; j < n; ++j) {
            Vector3 diff = positions[j] - positions[i];
            double distSq = diff.magnitudeSquared() + softening;
            double dist = std::sqrt(distSq);
            double invDistCube = 1.0 / (distSq * dist);

            double forceMag_i = G_CONST * masses[j] * invDistCube;
            double forceMag_j = G_CONST * masses[i] * invDistCube;

            outAccels[i] = outAccels[i] + diff * forceMag_i;
            outAccels[j] = outAccels[j] - diff * forceMag_j;
        }
    }
}

// 4th-Order Runge-Kutta (RK4) integration step
void NBodySimulator::stepRK4() {
    size_t n = bodies.size();
    if (n == 0) return;

    std::vector<Vector3> pos0(n), vel0(n), acc0(n);
    std::vector<double> masses(n);

    for (size_t i = 0; i < n; ++i) {
        pos0[i] = bodies[i].position;
        vel0[i] = bodies[i].velocity;
        masses[i] = bodies[i].mass;
    }

    double dt = timeStep;

    // k1
    computeAccelerations(pos0, masses, acc0);

    // k2
    std::vector<Vector3> pos1(n), vel1(n), acc1(n);
    for (size_t i = 0; i < n; ++i) {
        pos1[i] = pos0[i] + vel0[i] * (0.5 * dt);
        vel1[i] = vel0[i] + acc0[i] * (0.5 * dt);
    }
    computeAccelerations(pos1, masses, acc1);

    // k3
    std::vector<Vector3> pos2(n), vel2(n), acc2(n);
    for (size_t i = 0; i < n; ++i) {
        pos2[i] = pos0[i] + vel1[i] * (0.5 * dt);
        vel2[i] = vel0[i] + acc1[i] * (0.5 * dt);
    }
    computeAccelerations(pos2, masses, acc2);

    // k4
    std::vector<Vector3> pos3(n), vel3(n), acc3(n);
    for (size_t i = 0; i < n; ++i) {
        pos3[i] = pos0[i] + vel2[i] * dt;
        vel3[i] = vel0[i] + acc2[i] * dt;
    }
    computeAccelerations(pos3, masses, acc3);

    // RK4 combination: y(t+dt) = y(t) + dt/6 * (k1 + 2*k2 + 2*k3 + k4)
    for (size_t i = 0; i < n; ++i) {
        Vector3 dPos = (vel0[i] + vel1[i] * 2.0 + vel2[i] * 2.0 + vel3[i]) * (dt / 6.0);
        Vector3 dVel = (acc0[i] + acc1[i] * 2.0 + acc2[i] * 2.0 + acc3[i]) * (dt / 6.0);

        bodies[i].position = bodies[i].position + dPos;
        bodies[i].velocity = bodies[i].velocity + dVel;
        bodies[i].acceleration = acc0[i];
    }
}

// Procedural multi-octave 3D harmonic noise
double ProceduralUniverseGenerator::computeOctaveNoise(double x, double y, double z, int octaves, double persistence, double lacunarity) {
    double total = 0.0;
    double frequency = 1.0;
    double amplitude = 1.0;
    double maxValue = 0.0;

    for (int i = 0; i < octaves; ++i) {
        double nx = x * frequency;
        double ny = y * frequency;
        double nz = z * frequency;
        
        // Fast trigonometric pseudo-hash harmonic
        double val = std::sin(nx * 1.341 + std::cos(ny * 2.451 + nz * 0.912)) *
                     std::cos(nz * 1.873 + std::sin(nx * 0.512 + ny * 1.234));

        total += val * amplitude;
        maxValue += amplitude;
        amplitude *= persistence;
        frequency *= lacunarity;
    }

    return total / (maxValue > 0 ? maxValue : 1.0);
}

RealityBubbleMetric ProceduralUniverseGenerator::calculateBubbleHarmonic(double time, double baseRadius, double resonanceFreq) {
    double pulse = std::sin(time * resonanceFreq) * 0.05 + std::cos(time * resonanceFreq * 0.38) * 0.02;
    double r = baseRadius * (1.0 + pulse);
    double curvature = (G_CONST * SOLAR_MASS * 1e4) / (r * r * SPEED_OF_LIGHT * SPEED_OF_LIGHT);

    return RealityBubbleMetric{
        .posX = 0.0,
        .posY = 0.0,
        .posZ = 0.0,
        .radius = r,
        .spacetimeCurvature = curvature,
        .harmonicPhase = pulse
    };
}

double ProceduralUniverseGenerator::calculateSchwarzschildRadius(double mass) {
    return (2.0 * G_CONST * mass) / (SPEED_OF_LIGHT * SPEED_OF_LIGHT);
}

double ProceduralUniverseGenerator::calculateRelativisticTimeDilation(double radius, double mass) {
    double r_s = calculateSchwarzschildRadius(mass);
    if (radius <= r_s) return 0.0; // Event horizon frozen time
    return std::sqrt(1.0 - (r_s / radius));
}

} // namespace Cosmos

// Standard C-Linkage FFI exports
extern "C" {

void* cosmos_create_simulator() {
    return new Cosmos::NBodySimulator();
}

void cosmos_destroy_simulator(void* handle) {
    if (handle) {
        delete static_cast<Cosmos::NBodySimulator*>(handle);
    }
}

void cosmos_add_body(void* handle, uint32_t id, double mass, double radius, double px, double py, double pz, double vx, double vy, double vz) {
    if (!handle) return;
    auto* sim = static_cast<Cosmos::NBodySimulator*>(handle);
    sim->addBody(id, mass, radius, Cosmos::Vector3{px, py, pz}, Cosmos::Vector3{vx, vy, vz});
}

void cosmos_step_simulation(void* handle, double dt, int iterations) {
    if (!handle) return;
    auto* sim = static_cast<Cosmos::NBodySimulator*>(handle);
    sim->setTimeStep(dt);
    for (int i = 0; i < iterations; ++i) {
        sim->stepRK4();
    }
}

void cosmos_get_body_state(void* handle, uint32_t index, double* outPos, double* outVel) {
    if (!handle || !outPos || !outVel) return;
    auto* sim = static_cast<Cosmos::NBodySimulator*>(handle);
    const auto& bodies = sim->getBodies();
    if (index < bodies.size()) {
        outPos[0] = bodies[index].position.x;
        outPos[1] = bodies[index].position.y;
        outPos[2] = bodies[index].position.z;
        outVel[0] = bodies[index].velocity.x;
        outVel[1] = bodies[index].velocity.y;
        outVel[2] = bodies[index].velocity.z;
    }
}

double cosmos_compute_fractal_potential(double x, double y, double z, int octaves) {
    return Cosmos::ProceduralUniverseGenerator::computeOctaveNoise(x, y, z, octaves, 0.5, 2.0);
}

double cosmos_time_dilation(double radius, double mass) {
    return Cosmos::ProceduralUniverseGenerator::calculateRelativisticTimeDilation(radius, mass);
}

}
