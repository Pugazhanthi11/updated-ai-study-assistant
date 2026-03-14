require("dotenv").config()

const express = require("express")
const cors = require("cors")
const Groq = require("groq-sdk")
const multer = require("multer")
const pdf = require("pdf-parse")
const fs = require("fs")
const dns = require("dns")
const mongoose = require("mongoose")
const bcrypt = require("bcryptjs")
const nodemailer = require("nodemailer")

dns.setServers(["1.1.1.1","8.8.8.8"])

const app = express()

app.use(cors())
app.use(express.json())

/* ================= GROQ ================= */

const groq = new Groq({
apiKey: process.env.GROQ_API_KEY
})

/* ================= DATABASE ================= */

mongoose.connect(process.env.MONGODB_URI)
.then(()=>console.log("MongoDB Atlas Connected"))
.catch(err=>console.log(err))

/* ================= USER MODEL ================= */

const userSchema = new mongoose.Schema({

name:String,
email:{type:String,unique:true},
phone:String,
password:String,

deleted:{
type:Boolean,
default:false
},

reactivated:{
type:Boolean,
default:false
}

})
const User = mongoose.model("User",userSchema)

/* ================= CHAT MODEL ================= */

const chatSchema = new mongoose.Schema({

userId:String,
conversationId:String,

question:String,
answer:String,

deleted:{
type:Boolean,
default:false
},

date:{
type:Date,
default:Date.now
}

})

const Chat = mongoose.model("Chat",chatSchema)

/* ================= EMAIL CONFIG ================= */

const transporter = nodemailer.createTransport({

service:"gmail",

auth:{
user:process.env.EMAIL_USER,
pass:process.env.EMAIL_PASS
}

})

/* ================= PDF ================= */

let pdfText=""

const storage = multer.diskStorage({

destination:"uploads/",

filename:(req,file,cb)=>{
cb(null,Date.now()+"-"+file.originalname)
}

})

const upload = multer({storage})

/* ================= SIGNUP ================= */

app.post("/signup",async(req,res)=>{

try{

const {name,email,phone,password}=req.body

const emailRegex=/^[^\s@]+@[^\s@]+\.[^\s@]+$/
const phoneRegex=/^[6-9]\d{9}$/

if(!emailRegex.test(email)){
return res.json({error:"Invalid email format"})
}

if(!phoneRegex.test(phone)){
return res.json({error:"Invalid phone number"})
}

const existingUser=await User.findOne({email})

/* CASE 1: USER EXISTS BUT DELETED */

if(existingUser && existingUser.deleted){

const hash=await bcrypt.hash(password,10)

existingUser.name=name
existingUser.phone=phone
existingUser.password=hash
existingUser.deleted=false
existingUser.reactivated=true

await existingUser.save()

console.log("User reactivated:",email)

return res.json({
message:"Account reactivated successfully"
})

}

/* CASE 2: USER EXISTS AND ACTIVE */

if(existingUser && !existingUser.deleted){

return res.json({
error:"Email already registered"
})

}

/* CASE 3: NEW USER */

const hash=await bcrypt.hash(password,10)

await User.create({

name,
email,
phone,
password:hash

})

console.log("New user created:",email)

res.json({message:"Signup successful"})

}catch(err){

res.json({error:"Signup error"})

}

})

/* ================= LOGIN ================= */

app.post("/login",async(req,res)=>{

const {email,password}=req.body

const user=await User.findOne({email})

if(!user){
return res.json({error:"User not found"})
}

if(user.deleted){
return res.json({error:"This account has been deleted"})
}

const match=await bcrypt.compare(password,user.password)

if(!match){
return res.json({error:"Incorrect password"})
}

res.json({
userId:user._id,
name:user.name,
email:user.email,
phone:user.phone
})

})

/* ================= FORGOT PASSWORD ================= */

app.post("/forgot-password", async (req,res)=>{

try{

const {email}=req.body

const user=await User.findOne({email})

if(!user){
return res.json({message:"Email not registered"})
}

/* Generate temporary password */

const tempPassword=Math.random().toString(36).slice(-8)

/* Hash temporary password */

const hash=await bcrypt.hash(tempPassword,10)

/* Update database */

user.password=hash
await user.save()

/* Send email */

await transporter.sendMail({

from:process.env.EMAIL_USER,
to:email,
subject:"AI Study Assistant Password Reset",

html:`
<h2>Password Reset</h2>
<p>Your temporary password is:</p>
<h3>${tempPassword}</h3>
<p>Please login and change your password.</p>
`

})

res.json({message:"Temporary password sent to email"})

}catch(err){

console.log(err)
res.json({message:"Error sending email"})

}

})

/* ================= DELETE ACCOUNT ================= */

app.post("/delete-account",async(req,res)=>{

try{

const {userId,password}=req.body

const user=await User.findById(userId)

if(!user){
return res.json({error:"User not found"})
}

const match=await bcrypt.compare(password,user.password)

if(!match){
return res.json({error:"Incorrect password"})
}

user.deleted=true
await user.save()

res.json({message:"Account deleted"})

}catch(err){

res.json({error:"Delete failed"})

}

})

/* ================= UPLOAD PDF ================= */

app.post("/upload-pdf",upload.single("pdf"),async(req,res)=>{

const buffer=fs.readFileSync(req.file.path)

const data=await pdf(buffer)

pdfText=data.text

res.json({message:"PDF uploaded"})

})

/* ================= ASK AI ================= */

app.post("/ask",async(req,res)=>{

const {question,conversationId,userId}=req.body

let prompt=question

if(pdfText && question.toLowerCase().includes("pdf")){

prompt=`Use this document to answer:

${pdfText}

Question:
${question}`

}

const completion=await groq.chat.completions.create({

messages:[
{role:"user",content:prompt}
],

model:"llama-3.3-70b-versatile"

})

const answer=completion.choices[0].message.content

await Chat.create({

userId,
conversationId,
question,
answer,
deleted:false

})

res.json({answer})

})

/* ================= SUMMARY ================= */

app.get("/summary",async(req,res)=>{

const prompt=`Summarize this document in bullet points:

${pdfText}`

const completion=await groq.chat.completions.create({

messages:[{role:"user",content:prompt}],
model:"llama-3.3-70b-versatile"

})

res.json({answer:completion.choices[0].message.content})

})

/* ================= QUIZ ================= */

app.get("/quiz",async(req,res)=>{

const prompt=`Create 5 quiz questions with answers from this document:

${pdfText}`

const completion=await groq.chat.completions.create({

messages:[{role:"user",content:prompt}],
model:"llama-3.3-70b-versatile"

})

res.json({answer:completion.choices[0].message.content})

})

/* ================= USER HISTORY ================= */

app.get("/history/:userId",async(req,res)=>{

const history=await Chat.aggregate([

{
$match:{
userId:req.params.userId,
deleted:false
}
},

{
$group:{
_id:"$conversationId",
question:{$first:"$question"}
}
},

{$sort:{_id:-1}}

])

res.json(history)

})

/* ================= OPEN CONVERSATION ================= */

app.get("/conversation/:id",async(req,res)=>{

const msgs=await Chat.find({

conversationId:req.params.id,
deleted:false

}).sort({date:1})

res.json(msgs)

})

/* ================= DELETE HISTORY ================= */

app.post("/delete-history",async(req,res)=>{

const {conversationId,userId}=req.body

await Chat.updateMany(

{
conversationId,
userId
},

{
$set:{deleted:true}
}

)

res.json({message:"History hidden"})

})

/* ================= RESET ================= */

app.post("/reset",(req,res)=>{

pdfText=""

res.json({message:"reset"})

})

/* ================= SERVER ================= */

app.listen(5000,()=>{

console.log("Server running on port 5000")

})