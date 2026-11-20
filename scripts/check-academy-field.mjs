import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {build} from 'esbuild'
import React from 'react'
import TestRenderer,{act} from 'react-test-renderer'
const file=path.resolve('node_modules/.cache/academy-field-test.mjs');fs.mkdirSync(path.dirname(file),{recursive:true});await build({entryPoints:['src/academy/AcademyField.tsx'],outfile:file,bundle:true,jsx:'automatic',platform:'node',format:'esm',external:['react','react/jsx-runtime']});const {AcademyField}=await import('file://'+file+'?'+Date.now())
let tree;await act(async()=>{tree=TestRenderer.create(React.createElement(AcademyField,{locale:'fa'},React.createElement('label',null,'انتخاب دوره',React.createElement('select',{value:'2',onChange:()=>{}},Array.from({length:12},(_,i)=>React.createElement('option',{key:i,value:String(i)},'دوره '+i))))))})
let search=tree.root.findByProps({type:'search'});assert.match(search.props['aria-label'],/جستجو/);await act(async()=>search.props.onChange({target:{value:'11'}}));const options=tree.root.findAllByType('option');assert(options.some(x=>x.props.value==='11'));assert(options.some(x=>x.props.value==='2'));assert(!options.some(x=>x.props.value==='5'));assert.equal(tree.root.findAllByType('button').length,0);await act(async()=>tree.unmount());
await act(async()=>{tree=TestRenderer.create(React.createElement(AcademyField,{locale:'fa'},React.createElement('label',null,'توضیحات',React.createElement('textarea'))))});const button=tree.root.findByType('button');await act(async()=>button.props.onFocus());assert.equal(button.props['aria-expanded'],true);assert.match(tree.root.findByProps({role:'note'}).children.join(''),/توضیحات/);const control=tree.root.findByProps({className:'academy-help-control'});await act(async()=>control.props.onMouseLeave());assert.equal(button.props['aria-expanded'],false);await act(async()=>tree.unmount());console.log('PASS field help: searchable dropdown without icon, localized hover/focus help')
