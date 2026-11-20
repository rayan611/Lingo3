import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {build} from 'esbuild'
import React from 'react'
import TestRenderer,{act} from 'react-test-renderer'
const file=path.resolve('node_modules/.cache/academy-field-test.mjs');fs.mkdirSync(path.dirname(file),{recursive:true});await build({entryPoints:['src/academy/AcademyField.tsx'],outfile:file,bundle:true,jsx:'automatic',platform:'node',format:'esm',external:['react','react/jsx-runtime']});const {AcademyField}=await import('file://'+file+'?'+Date.now())
let tree;await act(async()=>{tree=TestRenderer.create(React.createElement(AcademyField,{locale:'fa'},React.createElement('label',null,'انتخاب دوره',React.createElement('select',{value:'2',onChange:()=>{}},Array.from({length:12},(_,i)=>React.createElement('option',{key:i,value:String(i)},'دوره '+i))))))})
let search=tree.root.findByProps({type:'search'});assert.match(search.props['aria-label'],/جستجو/);await act(async()=>search.props.onChange({target:{value:'11'}}));const options=tree.root.findAllByType('option');assert(options.some(x=>x.props.value==='11'));assert(options.some(x=>x.props.value==='2'));assert(!options.some(x=>x.props.value==='5'));const button=tree.root.findAllByType('button').find(x=>x.props['aria-expanded']!==undefined);await act(async()=>button.props.onClick());assert.equal(button.props['aria-expanded'],true);assert.match(tree.root.findByProps({role:'note'}).children.join(''),/انتخاب دوره/);await act(async()=>tree.unmount());console.log('PASS field help: Persian labels, keyboard-compatible toggle, search and selected option retention')
