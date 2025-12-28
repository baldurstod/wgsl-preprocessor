import { WgslPreprocessor } from '../dist/index.js'

const s = `
#ifdef TEST1 // comment
	test1 is defined // comment
	#ifdef TEST2
		test2 is defined
	#else
		test2 is NOT defined
		#define TEST3
	#endif
#else
	#ifdef TEST3
		test3 is defined
	#endif
#endif
`
const s2 = `
#ifdef TEST1
	test1 is defined
#elifdef TEST2
	test2 is defined
#elifndef TEST3
	test3 is NOT defined
#else
	nothing is defined
#endif
`

console.info(WgslPreprocessor.preprocessWgsl(s, new Map([['TEST1']])));
console.info(WgslPreprocessor.preprocessWgsl(s2, new Map([['TEST1']])));
