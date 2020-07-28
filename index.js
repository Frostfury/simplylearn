var express                                         =   require('express'),
    app                                             =   express(),
    http                                            =   require('http').Server(app),
    io                                              =   require('socket.io')(http),
    bodyParser                                      =   require("body-parser"),
    multer                                          =   require("multer"),
    mongoose                                        =   require("mongoose"),
    formatMessage                                   =   require("./utils/messages"),
    moment                                          =   require("moment"),
    path                                            =   require('path'),
    fs                                              =   require('fs-extra'),
    {userJoin,getCurrentUser,userLeave,getRoom}     =   require("./utils/users"),
    teacherSchema                                   =   require("./models/teacher");
    mongoose.connect("mongodb+srv://KappiAdmin:Kappi@123@cluster0.myhwp.gcp.mongodb.net/teacher?retryWrites=true&w=majority", { useNewUrlParser: true });
// mongoose.connect("mongodb://localhost:27017/simplylearn", { useNewUrlParser: true });
mongoose.set('useFindAndModify', false);    

var storage = multer.diskStorage({
    destination: function(req,file,cb){
        let name = req.body.name;
        let path = './uploads/'+name;
        fs.mkdirsSync(path);
      cb(null,path);
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


const PORT = process.env.PORT || 1690   

app.get("/",function(req,res){
    res.render("index");
});

app.get("/teacher",function(req,res){
    res.render("teacher");
});

app.get("/student",function(req,res){
    res.render("student");
});

app.get("/info",function(req,res){
    res.render("info");
});

app.get("/donation",function(req,res){
    res.render("donation");
});

app.post("/teacher",uploads.array("pptimages",40),function(req,res){
    var newTeacher = teacherSchema();
    newTeacher.name = req.body.name;
    newTeacher.classname = req.body.classname;
    req.files.forEach(function(file){
        newTeacher.pptimages.push(file.path);
    });
    newTeacher.save(function(err,savedata){
        if(err){
            console.log(err);
            res.redirect("/teacher");
        }
        else{

            res.redirect("/teacher/"+savedata._id);
        }
    })
});

app.get("/teacher/:id",function(req,res){
    teacherSchema.findById(req.params.id,function(err,data){
        if(err){
            console.log(err);
            res.redirect("/teacher");
        }
        else{
            console.log(data);
            res.render("linkshare",{data:data});
        }
    });
});

app.get("/session/:id/teacher",function(req,res){
    teacherSchema.findById(req.params.id,function(err,data){
        if(err){
            console.log(err);
            res.redirect("/teacher");
        }
        else{
            res.render("presentation-page-teacher",{data:data});
        }
    });
});

app.get("/session/:id/recordteacher",function(req,res){
    teacherSchema.findById(req.params.id,function(err,data){
        if(err){
            console.log(err);
            res.redirect("/teacher");
        }
        else{
            res.render("working-on-this",{data:data});
        }
    });
});


app.get("/session/:id",function(req,res){
    teacherSchema.findById(req.params.id,function(err,data){
        if(err){
            console.log(err);
            res.redirect("/teacher");
        }
        else{
            res.render("presentation-page-student",{data:data});
        }
    });
});

app.post("/session/:id/teacher",function(req,res){
    teacherSchema.findById(req.params.id,function(err,data){
        if(err){
            console.log(err);
            res.redirect("/teacher");
        }
        else{
            let path = './uploads/'+data.name;
            fs.remove(path,function(err){
                if(err){
                    console.log(err);
                    res.redirect("/teacher");
                }
                else{
                    teacherSchema.deleteOne({_id:data._id},function(err){
                        if(err){
                            console.log(err);
                            res.redirect("/teacher");
                        }
                        else{
                            res.redirect("/");
                        }
                    })
                }
            })
        }
    })
})

io.on('connection',function(socket){
    socket.on('joinRoom',({username,room})=>{
        const user = userJoin(socket.id,username, room);
        socket.join(user.room);
        var userList = getRoom(room);
        io.to(user.room).emit('newUser',username);
        io.to(user.room).emit('userList',userList);
      })

      socket.on('currentslide',n =>{
        const user = getCurrentUser(socket.id);
        io.to(user.room).emit('changeslide',n);

      })
    //   socket.on('userLive',username =>{
    //     const user = getCurrentUser(socket.id);
    //     socket.username=username;

    //   })

      socket.on('chatMessage', msg =>{
        const user = getCurrentUser(socket.id);
        io.to(user.room).emit('message', formatMessage(user.username,msg));
      });

    socket.on('disconnect',()=>{
        const user = getCurrentUser(socket.id);
        userLeave(socket.id);
        if(user){
         var userList = getRoom(user.room);
            io.to(user.room).emit('deadUser',user.username);
            io.to(user.room).emit('userList',userList);
        }
      });
});


server=http.listen(PORT,function(){
    console.log("Runnning on 1690");
});
