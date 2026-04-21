use crate::{
    Simd,
    backend::{scalar::Fallback, wasm32::Simd128},
};

use super::WithSimd;

#[derive(Debug, Clone, Copy)]
#[non_exhaustive]
#[repr(u8)]
pub enum Arch {
    Scalar,
    Simd128,
}

impl Arch {
    pub fn new() -> Self {
        if Simd128::is_available() {
            Self::Simd128
        } else {
            Self::Scalar
        }
    }

    pub fn dispatch<Op: WithSimd>(self, op: Op) -> Op::Output {
        match self {
            Arch::Scalar => <Fallback as Simd>::vectorize(op),
            Arch::Simd128 => <Simd128 as Simd>::vectorize(op),
        }
    }
}

impl Default for Arch {
    fn default() -> Self {
        Self::new()
    }
}
