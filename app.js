//jshint esversion:6
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
// const md5 = require("md5");
// const bcrypt = require("bcrypt");
// const saltRounds = 10;
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require("mongoose-findorcreate");
const FacebookStrategy = require('passport-facebook').Strategy;



const app = express();
const port = process.env.PORT || 5000;

app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");

app.use(session({
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: true
}))

app.use(passport.initialize());
app.use(passport.session());



mongoose.connect(process.env.MONGO_URL);


const userSchema = new mongoose.Schema({
    email: String,
    password: String,
    googleId: String,
    facebookId: String,
    secret: String
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser((user, done) => {
    done(null, user.id);
});
passport.deserializeUser((id, cb) => {
    User.findById(id).then(() => {
        return cb(null, id);
    });
});

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
},
    function (accessToken, refreshToken, profile, cb) {
        
        User.findOrCreate({ username: profile.emails[0].value, googleId: profile.id }, function (err, user) {
            return cb(err, user);
        });
    }
));

passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    callbackURL: "http://localhost:3000/auth/facebook/secrets"
},
    function (accessToken, refreshToken, profile, cb) {
        console.log(profile);
        User.findOrCreate({ facebookId: profile.id }, function (err, user) {
            return cb(err, user);
        });
    }
));

app.get("/", (req, res) => {
    res.render("home");
});

app.get('/auth/facebook',
    passport.authenticate('facebook'));

app.get('/auth/facebook/secrets',
    passport.authenticate('facebook', { failureRedirect: '/login' }),
    function (req, res) {
        // Successful authentication, redirect home.
        res.redirect('/secrets');
    });

app.get('/auth/google',
    passport.authenticate('google', { scope: ['profile', "email"] }));

app.get('/auth/google/secrets',
    passport.authenticate('google', { failureRedirect: '/login' }),
    function (req, res) {
        // Successful authentication, redirect home.
        res.redirect("/secrets");
    });

app.get("/register", (req, res) => {
    res.render("register");
});
app.post("/register", (req, res) => {
    // bcrypt.hash(req.body.password, saltRounds, function(err, hash) {
    //     // Store hash in your password DB.
    //     const newUser = new User({
    //         email : req.body.username,
    //         password : hash
    //     })
    //     try{
    //         newUser.save();
    //         res.render("secrets");
    //     }
    //     catch(err){
    //         console.log(err);
    //     }
    // });

    //Using cookies and session
    User.register({ username: req.body.username }, req.body.password, function (err, user) {
        if (err) {
            console.log(err);
            res.redirect("/register");
        }
        else {
            -
                passport.authenticate("local")(req, res, function (err) {
                    res.redirect("/secrets");
                })
        }
    })
})

app.get("/secrets", async (req, res) => {
        const foundUsers = await User.find({"secret": {$ne: null}});
        if(foundUsers){
        res.render("secrets",{
            foundUsers : foundUsers
        });
    }
    })

app.get("/login", (req, res) => {
    res.render("login");
});
app.post("/login", async (req, res) => {
    // const email = req.body.username;
    // const password = req.body.password;

    // const foundUser = await User.findOne({email : email});
    // if(foundUser){
    //     bcrypt.compare(password, foundUser.password, function(err, result) {
    //         // result == true
    //         if(result === true){
    //             try{
    //                 res.render("secrets");
    //             }
    //             catch(err){
    //                 console.log(err);
    //             }
    //         }
    //         else{
    //             console.log("Password is incorrect");
    //             res.render("login");
    //         }
    //     });

    // }
    // else{
    //     console.log("email doesnt match");
    //     res.render("login");
    // }

    //Using cookies and sessions

    const user = new User({
        email: req.body.username,
        password: req.body.password
    });

    req.login(user, function (err) {
        if (err) {
            console.log(err);
        }
        else {
            passport.authenticate("local")(req, res, function () {
                res.redirect("/secrets");
            });
        }
    })
})

app.get("/submit", (req, res) => {
    if(req.isAuthenticated()){
        res.render("submit");
    }else{
        res.redirect("/login");
    }
})

app.post("/submit", async (req,res)=>{
    const secret = req.body.secret;
    console.log(req.user);
    const foundUser = await User.findById(req.user);
    foundUser.secret = secret;
    console.log(foundUser);
    foundUser.save();
    res.redirect("/secrets");
})

app.get("/logout", (req, res) => {
    req.logout(function (err) {
        if (err) {
            console.log(err);
        }
        else {
            res.redirect("/");
        }
    });
})

app.listen(port, () => {
    console.log(`Server started on port ${port}`);
})