var mongoose = require("mongoose");
var teacherSchema   =   new mongoose.Schema({
    name:String,
    classname:String,
    pptimages:[{
        type:String
    }]
});

module.exports  =   mongoose.model("teacher",teacherSchema);