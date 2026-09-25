import {cases as oldCases}from'../skill-expanded/cases.ts';
// Fresh challenge pairs authored after strategy design and locked before inference.
// Tuples: learner, partner context, evidence, expression, disputed.
type R=[string,string,string,string,boolean?];
const pairs:[string,string,R,R][]=[
 ['holder_context','possession_relationships',['Inés.','¿De quién es la bufanda?','contextual','successful'],['Inés.','','absent','not_applicable']],
 ['relevant_reply','possession_relationships',['De mi compañera.','¿De quién es el portátil?','direct','successful',true],['Hasta luego.','¿De quién es el portátil?','absent','not_applicable']],
 ['denial','possession_relationships',['Esta taza no es mía.','','direct','successful'],['Esta taza está fría.','','absent','not_applicable']],
 ['kinship','possession_relationships',['No es mi primo; es mi vecino.','','direct','successful'],['No es un primo; es un vecino.','','absent','not_applicable',true]],
 ['borrowed','possession_relationships',['El casco es de Irene, pero hoy lo uso yo.','','direct','successful'],['Hoy uso un casco azul.','','absent','not_applicable']],
 ['assignment','possession_relationships',['Nos asignaron estas taquillas; aquella es la nuestra.','','direct','successful'],['Nos asignaron unas taquillas junto a la entrada.','','direct','successful',true]],
 ['unfinished_holder','possession_relationships',['El paraguas pertenece a…','','direct','partial'],['El paraguas pertenece a la directora.','','direct','successful']],
 ['topic_switch','possession_relationships',['Tengo sueño.','¿De quién es el cuaderno?','absent','not_applicable'],['Tengo el cuaderno de mi sobrino.','¿De quién es el cuaderno?','direct','successful']],
 ['de_ambiguity','possession_relationships',['Es una mesa de madera.','','absent','not_applicable'],['Es la mesa de Daniela.','','direct','successful']],
 ['possessive_ellipsis','possession_relationships',['La tuya.','¿Cuál de las chaquetas vamos a llevar?','direct','successful'],['La azul.','¿Cuál de las chaquetas vamos a llevar?','absent','not_applicable']],
 ['reported_holder','possession_relationships',['Adrián dice que la finca es suya; yo no sé si es cierto.','','direct','successful'],['La palabra «suyo» aparece en el diccionario.','','absent','not_applicable']],
 ['holder_noise','possession_relationships',['Aunque lo compramos juntos, el recibo está a nombre de Eva y el coche es de los dos.','','direct','successful'],['Aunque llueve y hace frío, el autobús llega a las nueve y la parada está cerca.','','absent','not_applicable']],
 ['time_context','past_reference',['En noviembre.','¿Cuándo te mudaste?','contextual','successful'],['En noviembre.','¿Cuándo te vas a mudar?','absent','not_applicable']],
 ['time_unresolved','past_reference',['El sábado.','','unclear','unclear',true],['El sábado pasado.','','direct','partial',true]],
 ['past_present','past_reference',['Hace años vivíamos encima de una panadería.','','direct','successful'],['Vivimos encima de una panadería.','','unclear','unclear',true]],
 ['habit','past_reference',['De pequeño iba andando al colegio todos los días.','','direct','successful'],['Voy andando al colegio todos los días.','','absent','not_applicable']],
 ['negated_event','past_reference',['No hubo reunión la semana pasada.','','direct','successful'],['No habrá reunión la semana que viene.','','absent','not_applicable']],
 ['progressive','past_reference',['Mientras esperaba el taxi, empezó a nevar.','','direct','successful'],['Mientras espero el taxi, empieza a nevar.','','absent','not_applicable']],
 ['time_quote','past_reference',['«Anteayer» lleva ocho letras.','','absent','not_applicable'],['Anteayer perdimos el tren.','','direct','successful']],
 ['future_perfect','past_reference',['Cuando llegues, ya habré recogido todo.','','unclear','unclear',true],['Cuando llegaste, ya había recogido todo.','','direct','successful']],
 ['morphology','past_reference',['La semana pasada ella comprar dos entradas.','','direct','successful'],['La semana pasada ella que dos de.','','direct','unsuccessful',true]],
 ['account_completion','past_reference',['El mes pasado…','Cuéntame qué ocurrió.','direct','partial'],['El mes pasado cerraron la biblioteca.','Cuéntame qué ocurrió.','direct','successful']],
 ['no_partner_credit','past_reference',['Qué interesante.','Antes trabajaba en una editorial.','absent','not_applicable'],['Yo también trabajaba en una editorial.','Antes trabajaba en una editorial.','direct','successful']],
 ['temporal_discourse','past_reference',['Ahora vivo en Puebla; antes vivía en Mérida y luego pasé dos años en Toluca.','','direct','successful'],['Ahora vivo en Puebla; el próximo año viviré en Mérida y luego pasaré dos años en Toluca.','','absent','not_applicable']],
];
export function cases(){
 const fresh=pairs.flatMap(([cluster,focal,a,b],i)=>[a,b].map(([learner,partner,evidence,expression,contested],j)=>({id:`n${i+1}-${j}`,cluster:'new-'+cluster,partition:'fresh',focal,language:'Spanish',variety:'Mexico',input:{learner,...(partner?{preceding_partner:partner}:{})},targets:{[focal]:{evidence,expression}},contested:contested??false,review_note:contested?'Preflagged: multiple defensible interpretations or unresolved skill boundary.':'Paired challenge case; provisional authored reference, not independent gold review.'})));
 return [...oldCases().filter(c=>c.language==='Spanish').map(c=>({...c,partition:'development'})),...fresh];
}
