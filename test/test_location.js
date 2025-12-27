import { WgslPreprocessor } from '../dist/index.js'

const s = `

@vertex
fn vertex_main(
	@location(x) position: vec3f,
	@location(x) normal: vec3f,
	@location(x) texCoord: vec2f,
#ifdef USE_VERTEX_TANGENT
	@location(x) tangent: vec4f,
#endif
#ifdef USE_VERTEX_COLOR
	@location(x) color: vec4f,
#endif
#if defined(SKELETAL_MESH) && defined(HARDWARE_SKINNING)
	@location(x) boneWeights: vec3f,
	@location(x) boneIndices: vec3<u32>,
#endif
) -> VertexOut
{
	var output : VertexOut;
	return output;
}

@fragment
fn fragment_main(fragInput: VertexOut) -> vec4f
{
	return vec4f(1.0);
}
`

console.info(WgslPreprocessor.preprocessWgsl(s, new Map([])));
console.info(WgslPreprocessor.preprocessWgsl(s, new Map([['USE_VERTEX_COLOR']])));
console.info(WgslPreprocessor.preprocessWgsl(s, new Map([['SKELETAL_MESH'], ['HARDWARE_SKINNING']])));
console.info(WgslPreprocessor.preprocessWgsl(s, new Map([['USE_VERTEX_COLOR'], ['SKELETAL_MESH'], ['HARDWARE_SKINNING']])));
