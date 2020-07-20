var express                 =   require('express'),
    app                     =   express(),
    http                    =   require('http').Server(app),
    io                      =   require('socket.io')(http),
    bodyParser              =   require("body-parser"),
    multer                  =   require("multer"),
    mongoose                = require("mongoose"),
    moment                  =   require("moment"),
    path                    =   require('path');

mongoose.connect("mongodb://localhost:27017/simplylearn");
mongoose.set('useFindAndModify', false);    

var storage = multer.diskStorage({
    destination: function(req,file,cb){
      cb(null,'./uploads');
    },
    filename: function(req,file,cb){
      cb(null,file.originalname);
    }
  });
  var fileFilter = function(req,file,cb){
    if(file.mimetype ==='image/png' || file.mimetype==='image/jpeg'){
      cb(null,true);
    }
    else{
      cb(null,false);
    }
  }
  var uploads = multer({
    storage:storage, limits:{
    fieldSize: 1024*1024*5
    },
    fileFilter:fileFilter
  });
  

app.set("view engine","ejs");
app.use(bodyParser.urlencoded({extended:true}));
app.use('/uploads',express.static('uploads'));
app.use(express.static(path.join(__dirname,"views")));
// app.use(express.static(__dirname + '/routes'));
// app.use(methodOverride("_method"));

const PORT = process.env.PORT || 1690   

app.get("/",function(req,res){
    res.render("index");
});

app.get("/teacher",function(req,res){
    res.render("teacher");
});

app.post("/teacher",uploads.array("pptimages",25),function(req,res){
    console.log(req.body);
    console.log(req.files);
    
});

server=http.listen(PORT,function(){
    console.log("Runnning on 1690");
});
