#!/bin/bash
docker run --rm nvcr.io/nvidia/pytorch:24.05-py3 python -c "import torch; print('CUDA support:', torch.cuda.get_arch_list())"
