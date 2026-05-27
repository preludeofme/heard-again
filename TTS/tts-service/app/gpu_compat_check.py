"""
GPU Compatibility Check for RunPod TTS Worker.

RunPod dynamically allocates GPUs based on availability. Different GPU generations
have different CUDA compute capabilities (sm_XX). PyTorch must be compiled with
support for the GPU's architecture — otherwise model loading fails with opaque
errors like:

    OSError: libcudart.so.13: cannot open shared object file
    NVIDIA RTX PRO 6000 Blackwell... sm_120 is not compatible with this PyTorch

This module checks at startup whether the allocated GPU is compatible with the
installed PyTorch, and emits a clear, actionable error message if not.

Usage:
    from app.gpu_compat_check import check_gpu_compatibility, GPUCheckResult
    result = check_gpu_compatibility()
    if not result.compatible:
        print(result.message)  # human-readable failure
        sys.exit(1)
"""

from __future__ import annotations

import logging
import os
import platform
import shutil
import subprocess
import sys
from dataclasses import dataclass, field

import torch

logger = logging.getLogger(__name__)

# ── known-compatible compute capability sets ──────────────────────────────────
# Each PyTorch wheel / NGC container supports a specific set of sm_xx values.
# sm_90  = Hopper (H100, H200)
# sm_89  = Ada Lovelace / GeForce RTX 40xx (RTX 4090, RTX 6000 Ada)
# sm_87  = Ampere / Jetson Orin
# sm_86  = Ampere (A100, A30, RTX 30xx)
# sm_80  = Ampere (A100 base)
# sm_75  = Turing (T4, RTX 20xx)
# sm_70  = Volta (V100)
# sm_120 = Blackwell (B100, B200, RTX PRO 6000 Blackwell) — requires CUDA 13 / PyTorch 2.7+

# Minimum CUDA capability supported by the installed PyTorch.
# Parsed from torch.cuda.get_arch_list() or inferred from version.
SUPPORTED_CAPABILITIES: set[str] | None = None


def _parse_supported_capabilities() -> set[str]:
    """Detect what compute capabilities the installed PyTorch supports.

    Returns a set like {"70", "75", "80", "86", "87", "89", "90"} or None if
    we cannot determine (no CUDA, or parsing fails).
    """
    # Method 1: torch.cuda.get_arch_list() (PyTorch ≥1.12)
    if hasattr(torch.cuda, "get_arch_list"):
        try:
            arch_list = torch.cuda.get_arch_list()  # e.g. ["8.0", "8.6", "8.9", "9.0"]
            caps = set()
            for arch in arch_list:
                parts = arch.split(".")
                if len(parts) == 2:
                    caps.add(parts[0] + parts[1])  # "8.0" → "80"
            if caps:
                return caps
        except Exception:
            pass

    # Method 2: Infer from PyTorch version + NGC container version
    pt_major = torch.__version__.split(".")[0]
    pt_minor = torch.__version__.split(".")[1] if "." in torch.__version__ else "0"
    try:
        pt_major_i = int(pt_major)
        pt_minor_i = int(pt_minor.split("+")[0].split("a")[0].split("rc")[0])
    except (ValueError, IndexError):
        pt_major_i = 0
        pt_minor_i = 0

    # Broad mapping of PyTorch version → supported sm_xx sets
    # These are the CUDA architectures compiled into the official wheels/conda.
    # NGC containers may have different sets — but this is a reasonable fallback.
    #
    # Blackwell (sm_120) support timeline via NGC containers:
    #   NGC 25.08+ (CUDA 13.x) — PyTorch 2.7+ with sm_120 support
    #   NGC 25.12  — PyTorch 2.9+ with CUDA 13.1 (fully tested Blackwell)
    #   NGC 26.04  — PyTorch 2.12 with CUDA 13.2 (latest, safest)
    if pt_major_i >= 2 and pt_minor_i >= 7:
        # PyTorch 2.7+: supports Blackwell (sm_120) when compiled with CUDA 13.x
        # Check CUDA version to confirm it's actually a CUDA 13 build (not a CUDA 12 build of 2.7)
        cuda_v = torch.version.cuda or ""
        cuda_major = cuda_v.split(".")[0] if "." in cuda_v else "0"
        try:
            cuda_major_i = int(cuda_major)
        except ValueError:
            cuda_major_i = 0
        if cuda_major_i >= 13:
            return {"70", "75", "80", "86", "87", "89", "90", "120"}
        # PyTorch 2.7+ compiled with CUDA 12.x — no sm_120
        return {"70", "75", "80", "86", "87", "89", "90"}
    if pt_major_i >= 2 and pt_minor_i >= 5:
        # PyTorch 2.5+ supports Hopper (sm_90) but NOT Blackwell (sm_120)
        return {"70", "75", "80", "86", "87", "89", "90"}
    if pt_major_i >= 2 and pt_minor_i >= 4:
        return {"70", "75", "80", "86", "87", "89", "90"}
    if pt_major_i >= 2 and pt_minor_i >= 1:
        return {"70", "75", "80", "86", "87", "89"}
    if pt_major_i >= 2:
        return {"70", "75", "80", "86"}
    if pt_major_i == 1 and pt_minor_i >= 13:
        return {"70", "75", "80", "86"}
    return {"70", "75", "80"}  # conservative ancient default


@dataclass
class GPUCheckResult:
    compatible: bool
    gpu_name: str = ""
    gpu_capability: str = ""  # e.g. "120" for sm_120
    pytorch_arch_list: str = ""  # e.g. "sm_70 sm_75 sm_80 sm_86 sm_87 sm_89 sm_90"
    pytorch_version: str = ""
    cuda_version: str = ""
    message: str = ""


def _get_gpu_info_via_nvidia_smi() -> tuple[str, str]:
    """Fallback: get GPU name and compute capability via nvidia-smi.

    Returns (gpu_name, capability_major_str) e.g. ("NVIDIA RTX PRO 6000", "12")
    or ("", "") if nvidia-smi is unavailable.
    """
    nvidia_smi = shutil.which("nvidia-smi")
    if not nvidia_smi:
        return "", ""

    try:
        # Query GPU 0's name and compute capability
        result = subprocess.run(
            [
                nvidia_smi,
                "--query-gpu=name,compute_cap",
                "--format=csv,noheader,nounits",
                "--id=0",
            ],
            capture_output=True,
            text=True,
            timeout=10,
        )
        if result.returncode != 0:
            return "", ""
        parts = result.stdout.strip().split(",")
        if len(parts) >= 2:
            name = parts[0].strip()
            cap = parts[1].strip()  # e.g. "12.0"
            major = cap.split(".")[0]  # "12"
            return name, major
        if len(parts) == 1:
            return parts[0].strip(), ""
        return "", ""
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
        return "", ""


def _get_gpu_info_via_pynvml() -> tuple[str, str]:
    """Get GPU name and compute capability via pynvml (nvidia-ml-py).

    Returns (gpu_name, capability_major_str) or ("", "") on failure.
    """
    try:
        from pynvml import (
            nvmlInit,
            nvmlDeviceGetHandleByIndex,
            nvmlDeviceGetName,
            nvmlDeviceGetCudaComputeCapability,
            nvmlShutdown,
        )

        nvmlInit()
        handle = nvmlDeviceGetHandleByIndex(0)
        name = nvmlDeviceGetName(handle)
        if isinstance(name, bytes):
            name = name.decode("utf-8")
        major, _ = nvmlDeviceGetCudaComputeCapability(handle)
        nvmlShutdown()
        return name, str(major)
    except Exception:
        return "", ""


def check_gpu_compatibility() -> GPUCheckResult:
    """Run GPU compatibility checks and return a structured result.

    Uses up to three detection methods (torch, nvml, nvidia-smi) to identify
    the GPU and compare against PyTorch's supported architectures.
    """
    result = GPUCheckResult(compatible=False)
    result.pytorch_version = torch.__version__

    # ── 1. Determine what capabilities the installed PyTorch supports ──
    global SUPPORTED_CAPABILITIES
    if SUPPORTED_CAPABILITIES is None:
        SUPPORTED_CAPABILITIES = _parse_supported_capabilities()
    result.pytorch_arch_list = ", ".join(
        sorted({f"sm_{c}" for c in (SUPPORTED_CAPABILITIES or set())}, key=lambda x: int(x[3:]))
    )

    # ── 2. Check CUDA availability ──
    if not torch.cuda.is_available():
        result.compatible = True  # CPU-only is fine (slow but works)
        result.message = (
            "CUDA not available — running on CPU. "
            "TTS will be slow but functional."
        )
        return result

    # ── 3. Get CUDA driver version ──
    try:
        result.cuda_version = torch.version.cuda or str(torch.cuda._cuda_version())
    except Exception:
        result.cuda_version = torch.cuda.get_device_capability().__repr__()

    # ── 4. Identify the GPU ──
    gpu_name = ""
    cap_major = ""

    # 4a: Try torch (fastest, no extra deps)
    try:
        props = torch.cuda.get_device_properties(0)
        gpu_name = props.name
        cap_major = str(props.major)  # e.g. "9" for sm_90, "12" for sm_120
    except Exception:
        pass

    # 4b: Try pynvml (more reliable naming)
    if not gpu_name:
        gpu_name, cap_major = _get_gpu_info_via_pynvml()

    # 4c: Fallback to nvidia-smi
    if not gpu_name:
        gpu_name, cap_major = _get_gpu_info_via_nvidia_smi()

    result.gpu_name = gpu_name
    result.gpu_capability = cap_major

    # ── 5. Compare capability against what PyTorch supports ──
    if not cap_major:
        # Could not determine GPU capability
        result.compatible = True  # assume compatible, let model loading decide
        result.message = (
            f"GPU '{gpu_name}' detected but compute capability could not be determined. "
            "Proceeding — model loading will catch incompatibilities."
        )
        return result

    if cap_major not in (SUPPORTED_CAPABILITIES or set()):
        # Compute capability is outside PyTorch's supported set
        # sm_12x (Blackwell) is the most common case here
        result.compatible = False
        result.message = (
            f"GPU INCOMPATIBILITY DETECTED\n"
            f"  GPU:         {gpu_name}\n"
            f"  Capability:  sm_{cap_major}\n"
            f"  PyTorch:     {result.pytorch_version} (supports {result.pytorch_arch_list})\n"
            f"  CUDA:        {result.cuda_version}\n"
            f"\n"
            f"The installed PyTorch ({result.pytorch_version}) was compiled for CUDA "
            f"architectures {result.pytorch_arch_list}, but the allocated GPU "
            f"({gpu_name}) requires compute capability sm_{cap_major}.\n"
            f"\n"
            f"RunPod dynamically allocates GPUs. This worker was assigned a GPU\n"
            f"that this container cannot use. Common scenarios:\n"
            f"\n"
            f"  a) Blackwell GPU (B100/B200/RTX PRO 6000): needs PyTorch ≥ 2.7\n"
            f"     compiled with CUDA ≥ 13.0. Update the NGC base image to\n"
            f"     nvcr.io/nvidia/pytorch:25.xx-py3 or newer.\n"
            f"\n"
            f"  b) Newer GPU architecture not yet in this PyTorch build:\n"
            f"     Rebuild the container with a newer PyTorch/NGC base.\n"
            f"\n"
            f"  c) Transient allocation issue: If this is intermittent, the\n"
            f"     RunPod endpoint may need a GPU type constraint (e.g. 'NVIDIA\n"
            f"     RTX 6000 Ada' or 'A100-80GB') to prevent Blackwell assignment.\n"
            f"\n"
            f"Action: The TTS worker will shut down. RunPod will auto-restart it\n"
            f"        and hopefully allocate a compatible GPU next time.\n"
        )
        return result

    # ── 6. All checks passed ──
    result.compatible = True
    result.message = (
        f"GPU compatibility PASSED\n"
        f"  GPU:         {gpu_name}\n"
        f"  Capability:  sm_{cap_major}\n"
        f"  PyTorch:     {result.pytorch_version} (supports {result.pytorch_arch_list})\n"
        f"  CUDA:        {result.cuda_version}"
    )
    return result


def exit_if_incompatible() -> None:
    """Run the compatibility check and exit with a clear message if incompatible.

    Call this at module import time (top-level) so the worker fails fast before
    any expensive model loading or job processing occurs.
    """
    result = check_gpu_compatibility()
    logger.info(result.message)

    if not result.compatible:
        logger.critical(result.message)
        # Flush logs so RunPod captures the error before we exit
        for handler in logger.root.handlers:
            handler.flush()
        print(result.message, file=sys.stderr, flush=True)
        sys.exit(1)
