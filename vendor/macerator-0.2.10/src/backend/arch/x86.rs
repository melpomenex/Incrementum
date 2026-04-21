use crate::{backend::scalar::Fallback, x86, Simd};

use super::WithSimd;

#[derive(Debug, Clone, Copy)]
#[non_exhaustive]
#[repr(u8)]
pub enum Arch {
    Scalar,
    V2,
    V3,
    #[cfg(avx512)]
    V4,
    #[cfg(fp16)]
    V4FP16,
}

impl Arch {
    pub fn new() -> Self {
        #[cfg(fp16)]
        if x86::V4FP16::is_available() {
            return Self::V4FP16;
        }
        #[cfg(avx512)]
        if x86::V4::is_available() {
            return Self::V4;
        }

        if x86::V3::is_available() {
            Self::V3
        } else if x86::V2::is_available() {
            Self::V2
        } else {
            Self::Scalar
        }
    }

    pub fn dispatch<Op: WithSimd>(self, op: Op) -> Op::Output {
        match self {
            Arch::Scalar => <Fallback as Simd>::vectorize(op),
            Arch::V2 => <x86::V2 as Simd>::vectorize(op),
            Arch::V3 => <x86::V3 as Simd>::vectorize(op),
            #[cfg(avx512)]
            Arch::V4 => <x86::V4 as Simd>::vectorize(op),
            #[cfg(fp16)]
            Arch::V4FP16 => <x86::V4FP16 as Simd>::vectorize(op),
        }
    }
}

impl Default for Arch {
    fn default() -> Self {
        Self::new()
    }
}
