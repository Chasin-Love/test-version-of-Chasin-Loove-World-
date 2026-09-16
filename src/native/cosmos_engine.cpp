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

/* ---------------------------------------------------------------------------
 * v2 renderer-facing core — exact numeric ports of src/physics/physicsEngine.ts
 * and the terrain noise in engine.ts. Any change to the TS reference must be
 * mirrored here (and vice versa) to keep native/WASM/TS tiers identical.
 * ------------------------------------------------------------------------- */

#include <cstring>
#include <chrono>
#include <limits>

namespace {

/* physicsEngine.ts CONSTANTS (subset used by the telemetry port) */
constexpr double K_G = 6.67430e-11;
constexpr double K_C = 299792458.0;
constexpr double K_M_SUN = 1.98847e30;
constexpr double K_R_SUN = 6.96342e8;
constexpr double K_L_SUN = 3.828e26;
constexpr double K_T_SUN = 5778.0;
constexpr double K_M_EARTH = 5.9722e24;
constexpr double K_AU = 1.495978707e11;
constexpr double K_G_EARTH = 9.80665;

struct BodyProfile {
    double eccentricity;
    double density;   /* g/cm^3 */
    double albedo;
};

/* physicsEngine.ts BODY_PROFILES — identical ids, values and defaults. */
const BodyProfile* bodyProfileOf(const char* id) {
    static const struct { const char* id; BodyProfile p; } TABLE[] = {
        {"anchor",  {0.0,    1.41,  0.00}},
        {"cinder",  {0.2056, 5.43,  0.12}},
        {"veil",    {0.0067, 5.24,  0.77}},
        {"aurelia", {0.0167, 5.51,  0.30}},
        {"rust",    {0.0934, 3.93,  0.25}},
        {"goliath", {0.0489, 1.33,  0.52}},
        {"mirror",  {0.0444, 1.90,  0.85}},
        {"hollow",  {0.2488, 1.85,  0.14}},
        {"wisp",    {0.1500, 0.001, 0.40}},
        {"eventide",{0.0,    1e12,  0.00}},
    };
    for (const auto& row : TABLE) {
        if (std::strcmp(row.id, id) == 0) return &row.p;
    }
    static const BodyProfile DEFAULT{0.05, 3.5, 0.3};
    return &DEFAULT;
}

/* Kepler solver shared by the single and batch ports. */
inline void keplerSolve(double a, double e, double phase, double incl,
                        double simDays, double speed, double* out) {
    e = std::fmin(0.85, std::fmax(0.0, e));

    double M = std::fmod(phase + simDays * speed, 2.0 * 3.14159265358979323846);
    if (M < 0) M += 2.0 * 3.14159265358979323846;

    double E = M;
    for (int i = 0; i < 5; ++i) {
        E = E - (E - e * std::sin(E) - M) / (1.0 - e * std::cos(E));
    }
    const double trueAnomaly =
        2.0 * std::atan2(std::sqrt(1.0 + e) * std::sin(E / 2.0),
                         std::sqrt(1.0 - e) * std::cos(E / 2.0));
    const double currentRadius = (a * (1.0 - e * e)) / (1.0 + e * std::cos(trueAnomaly));
    const double x = std::cos(trueAnomaly) * currentRadius;
    const double z = std::sin(trueAnomaly) * currentRadius;
    const double y = std::sin(trueAnomaly + phase) * currentRadius * incl;

    out[0] = x; out[1] = y; out[2] = z;
    out[3] = trueAnomaly; out[4] = currentRadius;
}

} // namespace

extern "C" {

const char* cosmos_version() {
    return COSMOS_VERSION_STRING;
}

void cosmos_orbit_position(double a, double eccentricity, double phase,
                           double inclination, double simDays, double speed,
                           double* out) {
    if (!out) return;
    keplerSolve(a, eccentricity, phase, inclination, simDays, speed, out);
}

void cosmos_kepler_batch(const double* a, const double* e, const double* phase,
                         const double* incl, const double* speed, int n,
                         double simDays, double* outXyz,
                         double* outRadius, double* outTrueAnomaly) {
    if (!a || !e || !phase || !incl || !speed || n <= 0) return;
    double tmp[5];
    for (int i = 0; i < n; ++i) {
        keplerSolve(a[i], e[i], phase[i], incl[i], simDays, speed[i], tmp);
        if (outXyz) {
            outXyz[3 * i + 0] = tmp[0];
            outXyz[3 * i + 1] = tmp[1];
            outXyz[3 * i + 2] = tmp[2];
        }
        if (outRadius) outRadius[i] = tmp[4];
        if (outTrueAnomaly) outTrueAnomaly[i] = tmp[3];
    }
}

void cosmos_physics_batch(const char* const* ids, const double* orbitA,
                          const double* radius, const int* kinds,
                          const int* hasRings, const double* phase,
                          const double* speed, int n, double simTimeSec,
                          double* out) {
    if (!ids || !orbitA || !radius || !kinds || !out || !phase || !speed || n <= 0) return;
    constexpr int F = COSMOS_PHYSICS_FIELD_COUNT;
    const double PI = 3.14159265358979323846;

    for (int b = 0; b < n; ++b) {
        const BodyProfile& profile = *bodyProfileOf(ids[b]);
        const int kind = kinds[b];
        const double aRaw = orbitA[b];

        double* o = out + (size_t)b * F;
        auto set = [&](int idx, double v) { o[idx] = v; };

        /* 1-2. scale + profile */
        const double a_AU = aRaw > 0 ? aRaw / 52.0 : 0.0;
        const double e = aRaw > 0 ? profile.eccentricity : 0.0;
        set(0, a_AU);
        set(1, e);

        /* 2. Kepler III */
        const double periodYears = a_AU > 0 ? std::sqrt(std::pow(a_AU, 3) / 1.0) : 0.0;
        const double periodDays = periodYears * 365.256;
        set(2, periodDays);
        set(3, periodYears);
        set(4, a_AU * (1.0 - e));
        set(5, a_AU * (1.0 + e));

        /* 3. Kepler I/II + vis-viva — same mean-anomaly formula as the TS reference */
        double meanM = std::fmod(phase[b] + simTimeSec * (speed[b] != 0.0 ? speed[b] : 0.01), 2.0 * PI);
        if (meanM < 0) meanM += 2.0 * PI;
        double E = meanM;
        for (int i = 0; i < 5; ++i) {
            E = E - (E - e * std::sin(E) - meanM) / (1.0 - e * std::cos(E));
        }
        const double trueAnomaly = 2.0 * std::atan2(std::sqrt(1.0 + e) * std::sin(E / 2.0),
                                                    std::sqrt(1.0 - e) * std::cos(E / 2.0));
        const double currentDistanceAU = a_AU > 0 ? (a_AU * (1.0 - e * e)) / (1.0 + e * std::cos(trueAnomaly)) : 0.0;
        const double v_earth = 29.78;
        const double currentVelocityKms = (a_AU > 0 && currentDistanceAU > 0)
            ? v_earth * std::sqrt(std::fmax(0.0, 2.0 / currentDistanceAU - 1.0 / a_AU)) : 0.0;
        set(6, currentDistanceAU);
        set(7, currentVelocityKms);
        set(8, a_AU > 0 ? v_earth / std::sqrt(a_AU) : 0.0);

        /* 4. mass/gravity */
        const double radiusKm = (radius[b] / 2.05) * 6371.0;
        const double radiusM = radiusKm * 1000.0;
        const double densityKgM3 = profile.density * 1000.0;
        const double volumeM3 = (4.0 / 3.0) * PI * std::pow(radiusM, 3);
        double massKg = volumeM3 * densityKgM3;
        if (kind == COSMOS_KIND_STAR) massKg = K_M_SUN;
        if (kind == COSMOS_KIND_HOLE || kind == COSMOS_KIND_VAULT) massKg = 10.0 * K_M_SUN;

        set(9, radiusKm);
        set(10, radiusKm / 6371.0);
        set(11, profile.density);
        set(12, massKg);
        set(13, massKg / K_M_EARTH);
        const double surfaceGravityMs2 = radiusM > 0 ? (K_G * massKg) / (radiusM * radiusM) : 0.0;
        set(14, surfaceGravityMs2);
        set(15, surfaceGravityMs2 / K_G_EARTH);
        set(16, radiusM > 0 ? std::sqrt((2.0 * K_G * massKg) / radiusM) / 1000.0 : 0.0);

        /* 4b. Newton force/potential/field/centripetal */
        const double distM = currentDistanceAU * K_AU;
        set(17, distM > 0 ? (K_G * K_M_SUN * massKg) / (distM * distM) : 0.0);
        set(18, distM > 0 ? -(K_G * K_M_SUN * massKg) / distM : 0.0);
        set(19, distM > 0 ? (K_G * K_M_SUN) / (distM * distM) : 0.0);
        const double velMs = currentVelocityKms * 1000.0;
        set(20, distM > 0 ? (massKg * velMs * velMs) / distM : 0.0);

        /* 5. Stefan-Boltzmann + greenhouse */
        const double flux = distM > 0 ? K_L_SUN / (4.0 * PI * std::pow(distM, 2)) : 0.0;
        set(21, flux);
        set(22, flux / 1361.0);
        set(23, profile.albedo);
        double eqTemp = distM > 0
            ? K_T_SUN * std::sqrt(K_R_SUN / (2.0 * distM)) * std::pow(1.0 - profile.albedo, 0.25) : 0.0;
        /* greenhouse bumps are keyed on ids exactly as in the TS reference */
        if (ids[b] && std::strcmp(ids[b], "aurelia") == 0) eqTemp += 33.0;
        if (ids[b] && std::strcmp(ids[b], "veil") == 0) eqTemp += 450.0;
        set(24, eqTemp);
        set(25, eqTemp - 273.15);
        int habit = COSMOS_HABIT_FROZEN;
        if (eqTemp >= 250.0 && eqTemp <= 325.0) habit = COSMOS_HABIT_GOLDILOCKS;
        else if (eqTemp > 325.0) habit = COSMOS_HABIT_TOO_HOT;
        set(26, (double)habit);

        /* 6. Roche */
        const double rocheKm = 2.44 * radiusKm * std::pow(densityKgM3 / 3000.0, 1.0 / 3.0);
        set(27, rocheKm);
        const double ringInnerKm = radiusKm * 1.45;
        set(28, (hasRings && hasRings[b]) ? (ringInnerKm <= rocheKm ? 1.0 : 0.0) : 0.0);

        /* 7. GR */
        const int isRel = (kind == COSMOS_KIND_HOLE || kind == COSMOS_KIND_VAULT) ? 1 : 0;
        set(29, (double)isRel);
        if (isRel) {
            const double rsM = (2.0 * K_G * massKg) / (K_C * K_C);
            const double rsKm = rsM / 1000.0;
            set(30, rsKm);
            set(31, 1.5 * rsKm);
            set(32, 3.0 * rsKm);
            set(33, std::sqrt(1.0 - 1.0 / 2.0));
        } else {
            set(30, std::numeric_limits<double>::quiet_NaN());
            set(31, std::numeric_limits<double>::quiet_NaN());
            set(32, std::numeric_limits<double>::quiet_NaN());
            set(33, std::numeric_limits<double>::quiet_NaN());
        }

        /* 8. axial spin + galactic orbit */
        const double axialDays = kind == COSMOS_KIND_STAR ? 25.05 : 1.0 + (radiusKm / 6371.0) * 0.5;
        set(34, axialDays);
        set(35, (2.0 * PI * radiusKm) / (axialDays * 86400.0));
        set(36, kind == COSMOS_KIND_STAR ? 7.25 : 23.44);
        set(37, 8.18);
        set(38, 230.0);
        set(39, 230.0);
        set(40, 4.15e6);
    }
}

double cosmos_terrain_fbm(double x, double y) {
    /* bit-exact port of engine.ts cpuFbm: 4 octaves of sin-hash value noise */
    auto hash = [](double hx, double hy) -> double {
        const double s = std::sin(hx * 127.1 + hy * 311.7) * 43758.5453;
        return s - std::floor(s);
    };
    auto vnoise = [&](double vx, double vy) -> double {
        const double xi = std::floor(vx), yi = std::floor(vy);
        const double xf = vx - xi, yf = vy - yi;
        const double u = xf * xf * (3.0 - 2.0 * xf);
        const double v = yf * yf * (3.0 - 2.0 * yf);
        const double qa = hash(xi, yi);
        const double qb = hash(xi + 1.0, yi);
        const double qc = hash(xi, yi + 1.0);
        const double qd = hash(xi + 1.0, yi + 1.0);
        return qa + (qb - qa) * u + (qc - qa) * v + (qa - qb - qc + qd) * u * v;
    };
    double f = 0.0, amp = 0.5, fx = x, fy = y;
    for (int i = 0; i < 4; ++i) {
        f += amp * (vnoise(fx, fy) * 2.0 - 1.0);
        fx *= 2.07;
        fy *= 2.03;
        amp *= 0.5;
    }
    return f;
}

double cosmos_benchmark_rk4(int nBodies, int iterations) {
    if (nBodies <= 0 || iterations <= 0) return 0.0;
    auto* sim = new Cosmos::NBodySimulator();
    for (int i = 0; i < nBodies; ++i) {
        const double fi = (double)i;
        sim->addBody((uint32_t)i, 1e24 + fi * 1e22, 1e6,
                     Cosmos::Vector3{fi * 1e9, fi * 2e9, fi * 0.5e9},
                     Cosmos::Vector3{1e3 + fi, 2e3, 0.5e3});
    }
    sim->setTimeStep(0.01);
    const auto t0 = std::chrono::steady_clock::now();
    for (int i = 0; i < iterations; ++i) sim->stepRK4();
    const auto t1 = std::chrono::steady_clock::now();
    const double seconds = std::chrono::duration<double>(t1 - t0).count();
    delete sim;
    if (seconds <= 0.0) return 0.0;
    return ((double)nBodies * (double)nBodies * (double)iterations) / seconds; /* pair-forces per second */
}

}
