// Normalize a selected joint category for comparison; preserve raw receipts separately.
export function normalizeJoint(receipt:any){
 const answers:Record<string,any>={};
 for(const [id,a]of Object.entries<any>(receipt.answers)){
  if(!id.endsWith('__joint')){answers[id]=a;continue;}
  const skill=id.slice(0,-7),[evidence,expression]=a.choice.split('__');
  for(const [index,dimension,choice,labels]of [[0,'evidence',evidence,['absent','contextual','direct','unclear']],[1,'expression',expression,['not_applicable','successful','partial','unsuccessful','unclear']]]as const){
   const probabilities:Record<string,number>=Object.fromEntries(labels.map(l=>[l,0]));
   for(const [key,p]of Object.entries<number>(a.probabilities)){const label=key.split('__')[index];if(!Object.hasOwn(probabilities,label))throw Error('Invalid joint label');probabilities[label]+=p;}
   answers[skill+'__'+dimension]={choice,probabilities,derivedFromJoint:id,confidence:a.confidence};
  }
 }
 return{...receipt,rawAnswers:receipt.answers,answers};
}
