let currentConversationId = Date.now().toString()
let questionCount = 0
let deleteMode = false
let studyMode = false

const userId = localStorage.getItem("userId")

if(!userId){
window.location.href="login.html"
}

/* ================= MESSAGE ================= */

function addStreamingMessage(text,type){

const chat=document.getElementById("chat-box")

const msg=document.createElement("div")
msg.className="message "+type

const avatar=document.createElement("div")
avatar.className="avatar"
avatar.innerHTML = type==="bot" ? "🤖" : "🧑"

const content=document.createElement("div")
content.className="text"

msg.appendChild(avatar)
msg.appendChild(content)

chat.appendChild(msg)

chat.scrollTop=chat.scrollHeight

let i=0
let rawText=""

function stream(){

if(i<text.length){

rawText += text.charAt(i)

/* convert markdown to HTML */

content.innerHTML = marked.parse(rawText)

/* highlight code blocks */

content.querySelectorAll("pre code").forEach((block)=>{
hljs.highlightElement(block)
})

i++

setTimeout(stream,10)

}

}

stream()

}


/* ================= ASK AI ================= */

async function askAI(){

const input=document.getElementById("question")

let question=input.value.trim()

if(!question) return

/* if study mode active add context */

if(studyMode){

question = "Answer from the uploaded study material: "+question

}

addStreamingMessage(marked.parse(question),"user")

input.value=""

questionCount++

document.getElementById("questionCount").innerText =
"Questions: "+questionCount

const typing=document.createElement("div")

typing.className="typing"
typing.innerHTML="<span></span><span></span><span></span>"

document.getElementById("chat-box").appendChild(typing)

try{

const res=await fetch("https://updated-ai-study-assistant-backend.onrender.com/ask",{

method:"POST",

headers:{
"Content-Type":"application/json"
},

body:JSON.stringify({

question,
conversationId:currentConversationId,
userId:userId

})

})

const data=await res.json()

typing.remove()

addStreamingMessage(data.answer,"bot")

loadHistory()

}catch(err){

typing.remove()

addStreamingMessage("Server error occurred.","bot")

}

}

/* ================= PDF UPLOAD ================= */

async function uploadPDF(){

const file=document.getElementById("pdfFile").files[0]

if(!file){
alert("Select a PDF first")
return
}

const formData=new FormData()

formData.append("pdf",file)

await fetch("https://updated-ai-study-assistant-backend.onrender.com/upload-pdf",{

method:"POST",
body:formData

})

studyMode=true

document.getElementById("studyModeBadge").style.display="block"

addStreamingMessage(
"📘 Study Mode Activated.\nYou can now ask questions from the uploaded document.",
"bot"
)

}

/* ================= SUMMARY ================= */

async function summarizePDF(){

const res=await fetch("https://updated-ai-study-assistant-backend.onrender.com/summary")

const data=await res.json()

addStreamingMessage(data.answer,"bot")

}

/* ================= QUIZ ================= */

async function generateQuiz(){

const res=await fetch("https://updated-ai-study-assistant-backend.onrender.com/quiz")

const data=await res.json()

addStreamingMessage(data.answer,"bot")

}

/* ================= NEW CHAT ================= */

async function newChat(){

currentConversationId=Date.now().toString()

await fetch("https://updated-ai-study-assistant-backend.onrender.com/reset",{method:"POST"})

studyMode=false

document.getElementById("studyModeBadge").style.display="none"

document.getElementById("chat-box").innerHTML=""

}

/* ================= VOICE ================= */

function startVoice(){

const recognition=new webkitSpeechRecognition()

recognition.lang="en-IN"

recognition.start()

recognition.onresult=function(event){

document.getElementById("question").value =
event.results[0][0].transcript

}

}

/* ================= HISTORY ================= */

async function loadHistory(){

const res=await fetch("https://updated-ai-study-assistant-backend.onrender.com/history/"+userId)

const data=await res.json()

const history=document.getElementById("history")

history.innerHTML=""

const deleted = JSON.parse(localStorage.getItem("deletedHistory")) || []

data.forEach(item=>{

if(deleted.includes(item._id)) return

const li=document.createElement("li")

li.dataset.id=item._id

if(deleteMode){

li.innerHTML=`
<label class="historyItem">
<input type="checkbox" class="historyCheck">
<span>${item.question}</span>
</label>
`

}else{

li.innerHTML=`<span>${item.question}</span>`

li.onclick=function(){
openConversation(item._id)
}

}

history.appendChild(li)

})

}

/* ================= DELETE HISTORY ================= */

function enableDeleteMode(){

deleteMode = true

document.getElementById("deleteControls").style.display = "block"

document.getElementById("historyMenu").style.display = "none"
loadHistory()

}

function deleteSelected(){

const checked=document.querySelectorAll(".historyCheck:checked")

if(checked.length===0){
alert("Select history to delete")
return
}

let deleted = JSON.parse(localStorage.getItem("deletedHistory")) || []

checked.forEach(cb=>{

const li=cb.closest("li")

const id=li.dataset.id

deleted.push(id)

li.remove()

})

localStorage.setItem("deletedHistory",JSON.stringify(deleted))

deleteMode=false

document.getElementById("deleteControls").style.display="none"

}

document.addEventListener("click", function(e){

const historyMenu = document.getElementById("historyMenu")
const deleteControls = document.getElementById("deleteControls")
const historySection = document.getElementById("history")

/* if clicking outside history area */

if(deleteMode && !historySection.contains(e.target) && !historyMenu.contains(e.target)){

deleteMode = false

deleteControls.style.display = "none"

loadHistory()

}

})
/* ================= OPEN CONVERSATION ================= */

async function openConversation(id){

currentConversationId=id

const res=await fetch("https://updated-ai-study-assistant-backend.onrender.com/conversation/"+id)

const data=await res.json()

const chat=document.getElementById("chat-box")

chat.innerHTML=""

data.forEach(msg=>{

addStreamingMessage(msg.question,"user")
addStreamingMessage(msg.answer,"bot")

})

}

/* ================= THEME ================= */

function toggleTheme(){

document.body.classList.toggle("dark")

}

/* ================= LOGOUT ================= */

function logout(){

localStorage.clear()

window.location.href="login.html"

}

/* ================= ENTER KEY ================= */

document.addEventListener("DOMContentLoaded", function(){

const textarea = document.getElementById("question")

/* ENTER SEND / SHIFT ENTER NEW LINE */

textarea.addEventListener("keydown", function(e){

if(e.key === "Enter" && !e.shiftKey){

e.preventDefault()

askAI()

}

})

/* AUTO EXPAND TEXTAREA */

textarea.addEventListener("input", function(){

this.style.height = "auto"

this.style.height = this.scrollHeight + "px"

})

})

function showDeleteBox(){

document.getElementById("deleteBox").style.display="block"

}

async function deleteAccount(){

const password=document.getElementById("deletePassword").value

const userId=localStorage.getItem("userId")

const res=await fetch("https://updated-ai-study-assistant-backend.onrender.com/delete-account",{

method:"POST",

headers:{
"Content-Type":"application/json"
},

body:JSON.stringify({
userId,
password
})

})

const data=await res.json()

if(data.error){

document.getElementById("deleteError").innerText=data.error

}else{

alert("Account deleted")

localStorage.clear()

window.location.href="login.html"

}

}

/* ================= MOBILE SIDEBAR ================= */

function toggleSidebar(){
document.getElementById("sidebar").classList.toggle("active")
}

loadHistory()

addStreamingMessage(
"Hello 👋 I am your AI Study Assistant.\nUpload a PDF to start Study Mode or ask any question.",
"bot"
)
