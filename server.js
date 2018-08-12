const express = require('express')
const app = express()
const bodyParser = require('body-parser')
const cors = require('cors')
const mongoose = require('mongoose')

app.use(cors())

app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())


app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true })
//I use an external UUID different to the ObjectId from mongoDB just to learn how to use it
//for this project the classic ObjectId would work. Check this link: https://www.mongodb.com/blog/post/generating-globally-unique-identifiers-for-use-with-mongodb.
const Schema = mongoose.Schema
//Subdoc, there is not need for creating the model
const exerciseSchema = new Schema({
    description: Schema.Types.String, 
    duration: Schema.Types.Number, 
    date: Schema.Types.Date
})
const userSchema = new Schema({
  userName: {type: Schema.Types.String, required: true},
  exercisesLength: {type: Schema.Types.Number},
  userExercises: [exerciseSchema]
})

const User = mongoose.model("User", userSchema)
const Exercise = mongoose.model("Exercise", exerciseSchema);
//Creating a new user
app.post("/api/exercise/new-user", (req, res, next) => {
  //Deal with repeat username and '' username
  if(req.body.username === '') res.send("Wrong user name")
  else 
    User.find({userName: req.body.username}, (err, users) => { //Check if there is an user with the same Id
      if(err) next(err)
      if(users.length) res.send("User name already taken")
      else 
        new User({userName: req.body.username, exercisesLength: 0, userExercises: []}) //Creates a new user and save the document
          .save((err, user) => {
          console.log(typeof user._id, user._id)
          res.json({userName: user.userName, id: user._id})
        })
    })
})
//Adding an exercise to an user
app.post("/api/exercise/add", (req, res) => {
  if (req.body.duration.trim().match(/[^\d]+/g) !== null) return res.send("Wrong duration") // To check that the duration only contain numbers
  const duration = parseInt(req.body.duration)
  const date = createDate(req.body.date);
  if (date == null) return res.send("Wrong date")
  User.findById(req.body.userId, (err, user) => { //Find the user to attach the exercise
    if (err || !user) return
    user.exercisesLength += 1 //Increment the exercises counter
    user.userExercises.push({ //Add the exercise to the user
      description: req.body.description,
      duration: duration,
      date: date})
    user.save((err) => !err //Save the document changes and return a json of the exercise if succeded
              ? res.json({
                  userId: user._id,
                  userName: user.userName,
                  description: req.body.description,
                  duration: duration,
                  date: date.toGMTString()}) 
              : res.send("There was an error adding the exercise"))
  })
})
//Get an user log of exercise
//userId[&from][&to][&limit]
app.get("/api/exercise/log?", (req, res) => {
  if(!req.query.userId) return res.send("No user id specified") //Missing or wrong format id
  console.log(req.query);
  User.findById(req.query.userId, (err, user) => { //Get the user
    if(!user || err) return res.send("There was an error with the user id") //Unexisting user
    let exercises = user.userExercises 
    if(req.query.from) { //Only exercises after from
      let dateFrom = createDate(req.query.from)
      if(dateFrom !== null) exercises = exercises.filter(e => e.date >= dateFrom)
    }
    if(req.query.to) { //Only exercises before to
      let dateTo = createDate(req.query.to)
      if(dateTo != null) exercises = exercises.filter(e => e.date <= dateTo)
    }
    if(req.query.limit) { //Only a certanin number (limit) of exercises
      let limit = parseInt(req.query.limit)
      if(!isNaN(limit)) exercises = exercises.slice(0, limit)
    }
    res.json({
      id: user._id,
      userName: user.userName,
      totalExercises: user.exercisesLength,
      logExercises: exercises.length,
      log: exercises.map(e => ({
        description: e.description,
        duration: e.duration,
        date: e.date.toGMTString()
      }))
    })
  })
})

const createDate = (dateString) => {
  let dateMatches = dateString.trim().match(/^(\d{4})-(0[1-9]|1[012])-([012]\d|3[01])$/) // To check the correct format in the date (not perfect, of course)
  if (dateMatches == null) return null //return res.send("Wrong date")  
  dateMatches = dateMatches.slice(1).map(v => parseInt(v)) //Cast the year, month and day to int and discard the whole date string
  return new Date(dateMatches[0], dateMatches[1] - 1, dateMatches[2])   
}

// Not found middleware

app.use((req, res, next) => {
  return next({status: 404, message: 'not found'})
})

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage

  if (err.errors) {
    // mongoose validation error
    errCode = 400 // bad request
    const keys = Object.keys(err.errors)
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500
    errMessage = err.message || 'Internal Server Error'
  }
  res.status(errCode).type('txt')
    .send(errMessage)
})

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
