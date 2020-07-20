const users = [];

function userJoin(id, username, room){
    const user = {id,room};
    users.push(user);
    return user;
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
    userLeave
};