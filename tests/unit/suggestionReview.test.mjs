import {test} from 'node:test'
import assert from 'node:assert/strict'
import {reviewHints,suggestionCounts,filterSuggestions,safeMailto,displayDate} from '../../src/lib/suggestionReview.js'
test('names, short, buying and multilingual messages never produce spam hints',()=>{
 for(const message of ['Hi','Need 2','价格？','كم السعر؟','¿Envían a México?','1234 cable please','買いたい'])assert.deepEqual(reviewHints({name:'Xzx998',message}),[])
 assert.match(reviewHints({message:'123456'})[0],/not spam/)
})
test('explainable hints preserve inbox and deliberate keep overrides them',()=>{
 const row={status:'new',message:'<script>alert(1)</script> https://a.test https://b.test https://c.test',review_state:'unreviewed'}
 assert.equal(reviewHints(row).length,2);assert.equal(filterSuggestions([row],'new','').length,1)
 assert.equal(filterSuggestions([row],'review','').length,1)
 assert.deepEqual(reviewHints({...row,review_state:'kept'}),[])
})
test('counts and filters consistently exclude only deliberate quarantine',()=>{
 const rows=[{status:'new',message:'123',review_state:'unreviewed'},{status:'new',review_state:'quarantined'},{status:'archived',review_state:'kept'},{status:'read',review_state:'unreviewed'}]
 assert.deepEqual(suggestionCounts(rows),{total:4,attention:1,quarantined:1})
 assert.equal(filterSuggestions(rows,'new','').length,1);assert.equal(filterSuggestions(rows,'all','123').length,1)
 assert.equal(filterSuggestions(rows,'quarantined','').length,1)
})
test('malformed content and mail links cannot execute markup or inject mail headers',()=>{
 for(const value of [null,{},5]){assert.doesNotThrow(()=>reviewHints({message:value}));assert.equal(safeMailto(value),null)}
 for(const value of ['x@test.com?bcc=other@test.com','x@test.com\r\nbcc:other@test.com','javascript:alert(1)','<script>@test.com'])assert.equal(safeMailto(value),null)
 assert.equal(safeMailto('a+part@test.com'),'mailto:a%2Bpart%40test.com')
 assert.equal(displayDate('bad'),'Unknown date')
})
