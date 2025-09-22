import { DOMParser } from "prosemirror-model";
import { schema } from "./editor/schema.js";

const htmlContent = `
<p class="screenplay-scene-heading">INT. HAWKINS POLICE STATION - MORNING</p>
<p class="screenplay-action">The small-town police station is quiet in the early morning light. Coffee brewing in the background. CHIEF JIM HOPPER sits at his desk, steam rising from his mug.</p>
<p class="screenplay-character">HOPPER</p>
<p class="screenplay-dialogue">You know what I always say...</p>
<p class="screenplay-parenthetical">(taking a slow sip)</p>
<p class="screenplay-dialogue">Mornings are for coffee and contemplation.</p>
<p class="screenplay-action">He leans back in his chair, looking out the window at the quiet town of Hawkins. Something feels different today.</p>
<p class="screenplay-character">FLO</p>
<p class="screenplay-parenthetical">(from the front desk)</p>
<p class="screenplay-dialogue">Chief, we got a call about some missing kid.</p>
<p class="screenplay-action">Hopper's peaceful moment is broken. He sets down his coffee and stands.</p>
<p class="screenplay-character">HOPPER</p>
<p class="screenplay-dialogue">Well, so much for contemplation.</p>
<p class="screenplay-transition">CUT TO:</p>
`;

const tempDiv = document.createElement("div");
tempDiv.innerHTML = htmlContent;

const domParser = DOMParser.fromSchema(schema);
export const doc = domParser.parse(tempDiv);

// export const doc = schema.node("doc", null, [
//   schema.node("paragraph", { class: "screenplay-action" })
// ]);