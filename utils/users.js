const users = [];

function userJoin(id,username, room){
    const user = {id,username,room};
    users.push(user);
    return user;
}

function getRoom(room){
    return users.filter(user=>user.room === room);
}

function getCurrentUser(id){
    return users.find(user=>user.id === id);
}

function userLeave(id){
    const index = users.findIndex(user => user.id === id);
    
    if(index !== -1){
        users.splice(index,1);
    }
}
module.exports = {
    userJoin,
    getCurrentUser,
    userLeave,
    getRoom
};