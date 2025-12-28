import { WgslPreprocessor } from '../dist/index.js'

const s = `

	@group(0) @binding(x) var<uniform> uniform0_0: vec3f;
	@group(0) @binding(x) var<uniform> uniform0_1: vec3f;
	@binding(x) @group(0)  var<uniform> uniform0_2: vec3f;
	@group(1) @binding(x) var<uniform> uniform1_0: vec3f;
	@group(2) @binding(x) var<uniform> uniform2_0: vec3f;
	@group(0) @binding(x) var<uniform> uniform0_3: vec3f;
	@group(1) @binding(x) var<uniform> uniform1_1: vec3f;
	@binding(x) @group(2) var<uniform> uniform2_1: vec3f;
`

console.info(WgslPreprocessor.preprocessWgsl(s, new Map([])));
