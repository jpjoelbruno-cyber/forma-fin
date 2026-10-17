/* Receivables are promises, never collected cash. Pure integer-centavo rules. */
(function(root){'use strict';
function balance(b){if(b.total_cents==null)return null;const n=b.pending_cents==null?Number(b.total_cents)-Number(b.paid_cents||0)-Number(b.waived_cents||0):Number(b.pending_cents);if(!Number.isSafeInteger(n))throw Error('Saldo inválido');return Math.max(0,n);}
function summarize(items,from,to,today){const rows=items.map(b=>({...b,pending_cents:balance(b)})).filter(b=>b.pending_cents>0).sort((a,b)=>(a.due_on||'9999').localeCompare(b.due_on||'9999')||String(a.client).localeCompare(String(b.client))||String(a.id).localeCompare(String(b.id)));
const period=rows.filter(b=>b.due_on&&b.due_on>=from&&b.due_on<=to),overdue=rows.filter(b=>b.due_on&&b.due_on<today),undated=rows.filter(b=>!b.due_on),alerts=rows.filter(b=>b.due_on&&b.due_on<=today),sum=a=>a.reduce((n,b)=>n+b.pending_cents,0);
return{rows,period,overdue,undated,alerts,period_cents:sum(period),overdue_cents:sum(overdue),undated_cents:sum(undated)};}
const api={balance,summarize};root.FormaCollectionsModel=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
