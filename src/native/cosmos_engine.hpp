#ifndef COSMOS_ENGINE_HPP
#define COSMOS_ENGINE_HPP

#include <vector>
#include <cmath>
#include <cstdint>
#include <string>

namespace Cosmos {

// Physical Constants in SI units
constexpr double G_CONST = 6.67430e-11; // m^3 kg^-1 s^-2
constexpr double SPEED_OF_LIGHT = 299792458.0; // m/s
constexpr double SOLAR_MASS = 1.98847e30; // kg
constexpr double AU_METERS = 1.495978707e11; // m

struct Vector3 {
    double x = 0.0;
    double y = 0.0;
    double z = 0.0;

    Vector3() = default;
    Vector3(double _x, double _y, double _z) : x(_x), y(_y), z(_z) {}

    Vector3 operator+(const Vector3& o) const { return {x + o.x, y + o.y, z + o.z}; }
    Vector3 operator-(const Vector3& o) const { return {x - o.x, y - o.y, z - o.z}; }
    Vector3 operator*(double s) const { return {x * s, y * s, z * s}; }
    Vector3 operator/(double s) const { return {x / s, y / s, z / s}; }

    double magnitudeSquared() const { return x * x + y * y + z * z; }
    double magnitude() const { return std::sqrt(magnitudeSquared()); }
    Vector3 normalized() const {
        double m = magnitude();
        return m > 1e-12 ? *this / m : Vector3{0, 0, 0};
    }
};

struct BodyState {
    uint32_t id;
    double mass;
    double radius;
    Vector3 position;
    Vector3 velocity;
    Vector3 acceleration;
};

struct RealityBubbleMetric {
    double posX;
    double posY;
    double posZ;
    double radius;
    double spacetimeCurvature;
    double harmonicPhase;
};

// High-Performance N-Body Gravitational RK4 Integrator
class NBodySimulator {
private:
    std::vector<BodyState> bodies;
    double timeStep = 0.01;

public:
    NBodySimulator() = default;

    void addBody(uint32_t id, double mass, double radius, const Vector3& pos, const Vector3& vel);
    void clear();
    void setTimeStep(double dt);
    
    // 4th-Order Runge-Kutta step integration
    void stepRK4();

    const std::vector<BodyState>& getBodies() const { return bodies; }
    size_t getBodyCount() const { return bodies.size(); }
};

// Procedural Multi-Octave Noise & Spacetime Metric Engine
class ProceduralUniverseGenerator {
public:
    static double computeOctaveNoise(double x, double y, double z, int octaves, double persistence, double lacunarity);
    static RealityBubbleMetric calculateBubbleHarmonic(double time, double baseRadius, double resonanceFreq);
    static double calculateSchwarzschildRadius(double mass);
    static double calculateRelativisticTimeDilation(double radius, double mass);
};

} // namespace Cosmos

// Standard C-Linkage FFI exports for Desktop (Linux .so, Windows .dll, Tauri, Node-API)
extern "C" {
    void* cosmos_create_simulator();
    void cosmos_destroy_simulator(void* handle);
    void cosmos_add_body(void* handle, uint32_t id, double mass, double radius, double px, double py, double pz, double vx, double vy, double vz);
    void cosmos_step_simulation(void* handle, double dt, int iterations);
    void cosmos_get_body_state(void* handle, uint32_t index, double* outPos, double* outVel);
    double cosmos_compute_fractal_potential(double x, double y, double z, int octaves);
    double cosmos_time_dilation(double radius, double mass);
}

#endif // COSMOS_ENGINE_HPP
