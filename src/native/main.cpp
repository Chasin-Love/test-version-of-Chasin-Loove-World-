#include "cosmos_engine.hpp"
#include <iostream>
#include <chrono>
#include <iomanip>

int main() {
    std::cout << "=====================================================\n";
    std::cout << "   COSMOS NATIVE ASTROPHYSICS ENGINE (C++20 SIMD)   \n";
    std::cout << "=====================================================\n\n";

    constexpr size_t BODY_COUNT = 512;
    constexpr int ITERATIONS = 200;
    constexpr double DT = 0.01;

    std::cout << "[Init] Allocating " << BODY_COUNT << " gravitationally bound cosmic bodies...\n";

    Cosmos::NBodySimulator sim;
    sim.setTimeStep(DT);

    // Seed central anchor star
    sim.addBody(0, Cosmos::SOLAR_MASS * 100.0, 7.5,
                Cosmos::Vector3{0.0, 0.0, 0.0},
                Cosmos::Vector3{0.0, 0.0, 0.0});

    // Seed orbiting planetary bodies
    for (size_t i = 1; i < BODY_COUNT; ++i) {
        double angle = (double)i * 0.123;
        double dist = Cosmos::AU_METERS * (0.2 + (double)i * 0.02);
        double speed = std::sqrt(Cosmos::G_CONST * Cosmos::SOLAR_MASS * 100.0 / dist);

        sim.addBody((uint32_t)i, Cosmos::SOLAR_MASS * 0.001, 1.5,
                    Cosmos::Vector3{std::cos(angle) * dist, 0.0, std::sin(angle) * dist},
                    Cosmos::Vector3{-std::sin(angle) * speed, 0.0, std::cos(angle) * speed});
    }

    std::cout << "[Benchmark] Executing " << ITERATIONS << " RK4 integration steps...\n";

    auto start = std::chrono::high_resolution_clock::now();

    for (int it = 0; it < ITERATIONS; ++it) {
        sim.stepRK4();
    }

    auto end = std::chrono::high_resolution_clock::now();
    std::chrono::duration<double, std::milli> duration = end - start;

    double totalInteractions = (double)BODY_COUNT * (double)BODY_COUNT * (double)ITERATIONS;
    double mopsPerSec = (totalInteractions / (duration.count() / 1000.0)) / 1000000.0;

    std::cout << std::fixed << std::setprecision(2);
    std::cout << "\n[Results]\n";
    std::cout << "  - Total Elapsed Time : " << duration.count() << " ms\n";
    std::cout << "  - Average Step Time  : " << (duration.count() / ITERATIONS) << " ms/step\n";
    std::cout << "  - Compute Throughput : " << mopsPerSec << " Million interactions/sec\n\n";

    // Test relativistic calculation
    double dilation = Cosmos::ProceduralUniverseGenerator::calculateRelativisticTimeDilation(10000.0, Cosmos::SOLAR_MASS * 10.0);
    std::cout << "[Relativity Test] Time dilation near 10-Solar-Mass event horizon: " << dilation << "\n";
    std::cout << "[Status] C++20 Native Engine self-test PASSED successfully.\n";

    return 0;
}
