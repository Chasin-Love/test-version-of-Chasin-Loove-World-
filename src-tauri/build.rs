fn has_cpp_compiler() -> bool {
    for tool in ["cl", "g++", "c++", "clang++"] {
        let probe = if cfg!(windows) {
            std::process::Command::new("where").arg(tool).output()
        } else {
            std::process::Command::new("which").arg(tool).output()
        };
        if let Ok(out) = probe {
            if out.status.success() {
                return true;
            }
        }
    }
    false
}

fn main() {
    if has_cpp_compiler() {
        // The C++ simulation core (src/native/cosmos_engine.cpp) is compiled
        // and linked directly into the Tauri binary. The renderer reaches it
        // through the invoke commands in src/lib.rs — no dlopen/LoadLibrary.
        cc::Build::new()
            .cpp(true)
            .file("../../src/native/cosmos_engine.cpp")
            .include("../../src/native")
            .std("c++20")
            .flag_if_supported("/O2")
            .flag_if_supported("/arch:AVX2")
            .flag_if_supported("-O3")
            .flag_if_supported("-ffast-math")
            .flag_if_supported("-mavx2")
            .compile("cosmos_engine");
        println!("cargo:rustc-cfg=cosmos_cpp");
    } else {
        // No C++ toolchain on this machine (e.g. a bare `cargo check` host):
        // build with the stub FFI so type-checking still works. Real builds
        // (CI windows-latest / ubuntu-latest, or after running
        // scripts/setup-windows-toolchain.ps1) compile the genuine core.
        println!("cargo:warning=No C++ compiler found — building with cosmos FFI stubs");
        println!("cargo:rustc-cfg=cosmos_stub");
    }

    tauri_build::build()
}
