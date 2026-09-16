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

/* ---------------------------------------------------------------------------
 * v2 batch exports — the renderer-facing simulation core.
 *
 * The webview renderer calls these through the Tauri shell (Rust FFI, C++
 * compiled into the binary via cc) or through the WASM build. The pure-TS
 * physicsEngine.ts remains the reference implementation and last-resort
 * fallback; these must stay numerically identical to it.
 * ------------------------------------------------------------------------- */

#define COSMOS_VERSION_STRING "2.0.0"

/* Field layout of each telemetry record produced by cosmos_physics_batch.
 * Mirrors BodyPhysicsData in src/physics/physicsEngine.ts in exact order. */
#define COSMOS_PHYSICS_FIELD_COUNT 41

/* habitableStatus encoding */
#define COSMOS_HABIT_FROZEN 0
#define COSMOS_HABIT_GOLDILOCKS 1
#define COSMOS_HABIT_TOO_HOT 2

/* body kind encoding passed to cosmos_physics_batch */
#define COSMOS_KIND_STAR 0
#define COSMOS_KIND_PLANET 1
#define COSMOS_KIND_DWARF 2
#define COSMOS_KIND_NEBULA 3
#define COSMOS_KIND_HOLE 4
#define COSMOS_KIND_VAULT 5

extern "C" {

    /* Engine identity for honest telemetry (never hard-code in JS again). */
    const char* cosmos_version();

    /* Single-body Kepler position — exact port of calculateKeplerPosition.
     * out receives 7 doubles: x, y, z, trueAnomaly, currentRadius (5 used). */
    void cosmos_orbit_position(double a, double eccentricity, double phase,
                               double inclination, double simDays, double speed,
                               double* out);

    /* Batch Kepler positions for n bodies per frame.
     * Inputs: per-body arrays a/e/phase/incl/speed (each n doubles) + simDays.
     * Outputs: outXyz (3n), outRadius (n), outTrueAnomaly (n). */
    void cosmos_kepler_batch(const double* a, const double* e, const double* phase,
                             const double* incl, const double* speed, int n,
                             double simDays, double* outXyz,
                             double* outRadius, double* outTrueAnomaly);

    /* Full astrophysics telemetry batch — exact port of calculatePhysics.
     * ids: n pointers to NUL-terminated body ids (profile lookup).
     * orbitA / radius / phase / speed: n doubles each. kinds: n ints
     * (COSMOS_KIND_*). hasRings: n ints (0/1). simTimeSec: sim time seconds.
     * out: n * COSMOS_PHYSICS_FIELD_COUNT doubles, row-major per body. */
    void cosmos_physics_batch(const char* const* ids, const double* orbitA,
                              const double* radius, const int* kinds,
                              const int* hasRings, const double* phase,
                              const double* speed, int n, double simTimeSec,
                              double* out);

    /* Terrain value-noise fbm — bit-exact port of cpuFbm in engine.ts
     * (4 octaves, sin-hash value noise) so native-driven terrain matches
     * the TS reference visually. */
    double cosmos_terrain_fbm(double x, double y);

    /* Benchmark: runs iterations of RK4 over n bodies, returns ops/sec.
     * Uses an internal simulator instance; no state leaks to the caller. */
    double cosmos_benchmark_rk4(int nBodies, int iterations);
}

#endif // COSMOS_ENGINE_HPP
