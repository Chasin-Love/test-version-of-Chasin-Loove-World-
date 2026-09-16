cmake_minimum_required(VERSION 3.20)
project(CosmosNativeEngine VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Optimization flags for Linux & Windows
if(MSVC)
    add_compile_options(/O2 /Oi /Ot /fp:fast /arch:AVX2 /W4)
else()
    add_compile_options(-O3 -ffast-math -mavx2 -mfma -Wall -Wextra -pedantic)
endif()

# Source files
set(SOURCES
    cosmos_engine.cpp
)

set(HEADERS
    cosmos_engine.hpp
)

# Build Shared Library (.so on Linux, .dll on Windows) for FFI/Tauri/Node-API
add_library(cosmos_engine SHARED ${SOURCES} ${HEADERS})

set_target_properties(cosmos_engine PROPERTIES
    PUBLIC_HEADER ${HEADERS}
    POSITION_INDEPENDENT_CODE ON
)

# Optional standalone native benchmark executable
add_executable(cosmos_benchmark main.cpp ${SOURCES} ${HEADERS})
target_link_libraries(cosmos_benchmark PRIVATE cosmos_engine)
