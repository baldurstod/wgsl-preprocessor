import { WgslPreprocessor } from '../dist/index.js'

//testIncludes();
testIf();
//testDefine();

function expandFinalLine(line) {
	if (!line.sourceName) {
		if (line.includeLine) {
			return `${line.line} ${expandFinalLine(line.includeLine)}`;
		} else {
			return `${line.line}`;
		}
	} else {
		if (line.includeLine) {
			return `${line.sourceName} ${line.originalLine} ${expandFinalLine(line.includeLine)}`;
		} else {
			return `${line.sourceName} ${line.originalLine}`;
		}
	}
}

function testIf() {
	console.info(WgslPreprocessor.preprocessWgsl(getTestIfString(), new Map([['TEST', '']])));
}

function testDefine() {
	console.info(WgslPreprocessor.preprocessWgsl(getTestDefineString()));
}

function testIncludes() {
	console.info(WgslPreprocessor.preprocessWgsl(testIncludesString, new Map([['TEST', '']])));
	console.info('-----------------------------------------------');
	console.info(WgslPreprocessor.preprocessWgsl(testIncludesString, new Map([['TES', '']])));

	/*
	const lines = WgslPreprocessor.preprocessWgslLineMap(test);
	for (const line of lines) {
		console.info(line.originalLine, expandFinalLine(line));
	}
	*/

	//console.info(WgslPreprocessor.getIncludeList(test, new Map([['TEST', '']])));
	//console.info(WgslPreprocessor.getIncludeList(test, new Map([['', '']])));
}

function getTestIfString() {
	return `#define TEST 1
#define NUM_POINT_LIGHTS 5

#if TEST == 1
	test equal 1
#else
	test not equal 1
#endif

#if NUM_POINT_LIGHTS == 0
	num point lights == 0
#elif NUM_POINT_LIGHTS > 3
	num point lights > 3 <NUM_POINT_LIGHTS>
#else
	num point lights > 0 and <= 3 <NUM_POINT_LIGHTS>
#endif


#if NUM_POINT_LIGHTS >= 1
	num point lights >= 1
#endif


`;
}

function getTestDefineString() {
	return `#define TEST 1
#define FOO 1
#undef TEST
#ifdef TEST
	#undef FOO
	test is defined = TEST
#else
	test is not defined
#endif

#ifdef FOO
	foo is defined = FOO
#else
	foo is not defined
#endif


`;
}

function getTestIncludesString() {
	return `#define defined_in_code 1
#ifdef TEST
 	#include include1
#else
	#include include2
#endif

#ifndef TEST
 	TEST is not defined
#else
	TEST is defined
#endif


#ifdef defined_in_code
	this line is defined in code
#endif

struct VertexOut {
	@builtin(position) position : vec4f,
}

@vertex
fn vertex_main(@location(0) position: vec3f) -> VertexOut
{
	var output : VertexOut;
	output.position = uniforms.projectionMatrix * uniforms.viewMatrix * uniforms.modelMatrix * vec4<f32>(position, 1.0);
	//output.position = vec4<f32>(position.x, position.y, position.z, 1.0);
	return output;
}

@fragment
fn fragment_main(fragData: VertexOut) -> @location(0) vec4f
{
	//return fragData.color;
	return vec4<f32>(1.0, 1.0, 1.0, 1.0);
}`
}
const include1 = `include1 line 1
include1 line 2
include1 line 3
include1 line 4`;

const include2 = `include2 line 1
include2 line 2
#include nested_include
include2 line 4`;

const nested_include = `nested_include line 1
nested_include line 2
#include nested_include_lvl2
nested_include line 4`;

const nested_include_lvl2 = `nested_include_lvl2 line 1
nested_include_lvl2 line 2
#include nested_include_lvl3
nested_include_lvl2 line 4`;

const nested_include_lvl3 = `nested_include_lvl3 line 1
nested_include_lvl3 line 2
#include recursive_include
nested_include_lvl3 line 4`;

const recursive_include = `recursive_include line 1
recursive_include line 2
#include recursive_include
recursive_include line 4`;


WgslPreprocessor.setWgslInclude('include1', include1);
WgslPreprocessor.setWgslInclude('include2', include2);
WgslPreprocessor.setWgslInclude('nested_include', nested_include);
WgslPreprocessor.setWgslInclude('nested_include_lvl2', nested_include_lvl2);
WgslPreprocessor.setWgslInclude('nested_include_lvl3', nested_include_lvl3);
WgslPreprocessor.setWgslInclude('recursive_include', recursive_include);
