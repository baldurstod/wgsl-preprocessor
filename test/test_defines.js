import { WgslPreprocessor } from '../dist/index.js'

const s = `
#ifdef TEST1
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


console.info(WgslPreprocessor.preprocessWgsl(s, new Map([['TEST1']])));
