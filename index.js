var express                 =   require('express'),
    app                     =   express(),
    http                    =   require('http').Server(app),
    io                      =   require('socket.io')(http),
    bodyParser              =   require("body-parser"),
    moment                  =   require("moment");

app.set("view engine","ejs");
app.use(bodyParser.urlencoded({extended:true}));
app.use(express.static(__dirname+"/public"));
// app.use(express.static(__dirname + '/routes'));
app.use(methodOverride("_method"));

const PORT = process.env.PORT || 3000    

app.get("/",function(req,res){
    req.logout();
    res.render("index");
});

server=http.listen(PORT,function(){
    console.log("Runnning on 1690");
});
