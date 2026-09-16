//! FFI surface to the C++ simulation core (src/native/cosmos_engine.cpp).
//!
//! Two compile modes (set by build.rs):
//! - `cosmos_cpp`: the real C++ core is compiled into the binary via cc and
//!   the extern declarations below link against it.
//! - `cosmos_stub`: no C++ compiler was available (bare `cargo check` host);
//!   Rust-side stubs keep the crate type-correct. A binary built this way
//!   reports `backend: "stub"` and never claims native physics.

#![allow(dead_code)]

use std::ffi::{c_char, c_double, c_int};

/// Body kind encoding — must mirror COSMOS_KIND_* in cosmos_engine.hpp and
/// the `kind` mapping in cpp_bridge.ts.
pub const KIND_STAR: i32 = 0;
pub const KIND_PLANET: i32 = 1;
pub const KIND_DWARF: i32 = 2;
pub const KIND_NEBULA: i32 = 3;
pub const KIND_HOLE: i32 = 4;
pub const KIND_VAULT: i32 = 5;

pub const PHYSICS_FIELD_COUNT: usize = 41;

#[cfg(cosmos_cpp)]
mod ffi {
    use std::ffi::{c_char, c_double, c_int};

    extern "C" {
        pub fn cosmos_version() -> *const c_char;
        pub fn cosmos_orbit_position(
            a: c_double,
            eccentricity: c_double,
            phase: c_double,
            inclination: c_double,
            sim_days: c_double,
            speed: c_double,
            out: *mut c_double,
        );
        pub fn cosmos_kepler_batch(
            a: *const c_double,
            e: *const c_double,
            phase: *const c_double,
            incl: *const c_double,
            speed: *const c_double,
            n: c_int,
            sim_days: c_double,
            out_xyz: *mut c_double,
            out_radius: *mut c_double,
            out_true_anomaly: *mut c_double,
        );
        pub fn cosmos_physics_batch(
            ids: *const *const c_char,
            orbit_a: *const c_double,
            radius: *const c_double,
            kinds: *const c_int,
            has_rings: *const c_int,
            phase: *const c_double,
            speed: *const c_double,
            n: c_int,
            sim_time_sec: c_double,
            out: *mut c_double,
        );
        pub fn cosmos_terrain_fbm(x: c_double, y: c_double) -> c_double;
        pub fn cosmos_benchmark_rk4(n_bodies: c_int, iterations: c_int) -> c_double;
    }
}

#[cfg(cosmos_stub)]
mod ffi {
    use std::ffi::{c_char, c_double, c_int};

    pub unsafe fn cosmos_version() -> *const c_char {
        b"stub\0".as_ptr() as *const c_char
    }
    pub unsafe fn cosmos_orbit_position(
        _a: c_double, _e: c_double, _phase: c_double, _incl: c_double,
        _days: c_double, _speed: c_double, out: *mut c_double,
    ) {
        if !out.is_null() {
            *out.add(0) = 0.0; *out.add(1) = 0.0; *out.add(2) = 0.0;
            *out.add(3) = 0.0; *out.add(4) = 0.0;
        }
    }
    pub unsafe fn cosmos_kepler_batch(
        _a: *const c_double, _e: *const c_double, _phase: *const c_double,
        _incl: *const c_double, _speed: *const c_double, n: c_int,
        _days: c_double, out_xyz: *mut c_double, out_radius: *mut c_double,
        out_anomaly: *mut c_double,
    ) {
        let n = n.max(0) as usize;
        if !out_xyz.is_null() { std::slice::from_raw_parts_mut(out_xyz, n * 3).fill(0.0); }
        if !out_radius.is_null() { std::slice::from_raw_parts_mut(out_radius, n).fill(0.0); }
        if !out_anomaly.is_null() { std::slice::from_raw_parts_mut(out_anomaly, n).fill(0.0); }
    }
    pub unsafe fn cosmos_physics_batch(
        _ids: *const *const c_char, _a: *const c_double, _r: *const c_double,
        _k: *const c_int, _h: *const c_int, _p: *const c_double, _s: *const c_double,
        n: c_int, _t: c_double, out: *mut c_double,
    ) {
        let n = n.max(0) as usize;
        if !out.is_null() { std::slice::from_raw_parts_mut(out, n * 41).fill(0.0); }
    }
    pub unsafe fn cosmos_terrain_fbm(_x: c_double, _y: c_double) -> c_double { 0.0 }
    pub unsafe fn cosmos_benchmark_rk4(_n: c_int, _i: c_int) -> c_double { 0.0 }
}

pub fn version_string() -> String {
    unsafe {
        let ptr = ffi::cosmos_version();
        if ptr.is_null() {
            return String::from("unknown");
        }
        std::ffi::CStr::from_ptr(ptr).to_string_lossy().into_owned()
    }
}
