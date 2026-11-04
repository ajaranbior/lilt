# Make a copy of kokoro-v1.0.onnx that also outputs per-token durations (frames of 600 samples).
# usage: python make_dur_model.py kokoro-v1.0.onnx kokoro-dur.onnx
import sys, onnx
m = onnx.load(sys.argv[1])
m.graph.output.append(onnx.helper.make_tensor_value_info("/encoder/Round_output_0", onnx.TensorProto.FLOAT, None))
onnx.save(m, sys.argv[2])
