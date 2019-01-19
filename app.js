const express = require('express');
const fetch = require('node-fetch');
const sassMiddleware = require('node-sass-middleware');
const path = require('path')
const fake_projects_json = require('./public/projects.json')
const app = express();


const api_key = 'CDzSiYZfM6sd2wZg';
const api_host = 'https://api.hackaday.io/v1';
const api_types = {
    project:'/projects',
    users:'/users/',
    usersbatch:'/users/batch'
};

const requestBuilder = (api_host, api_type, params={}) =>{
    res = api_host+api_type+'?';
    for (key in params){
        res+=key+'='+params[key]+'&';
    }
    return res;
}

const getProjects = async (page = '1',per_page = '20')=>{
    try{
        req = requestBuilder(api_host, api_types.project,{api_key:api_key,page:page,per_page:per_page});
        const res = await fetch(req);
        const json = await res.json();
        return json;
    }catch(err){
        console.log(err);
        return {error:err};
    }
}

const getUser = async (id = '1')=>{
    try{
        req = requestBuilder(api_host, api_types.users+id,{api_key:api_key});
        const res = await fetch(req);
        const json = await res.json();
        return json;
    }catch(err){
        console.log(err);
        return {error:err};
    }
}

const getOwners = async function(projects){
    //depratcated, using a promise.all fetch 20 username at once and update projects obj
    // try{
    //     if(!projects||!projects.projects) return projects;
    //     await Promise.all(projects.projects.map(async function(project,index,array){
    //         if(!project.owner_id) return;
    //         owner = await getUser(project.owner_id);
    //         if(!owner||owner.error)  array[index]['owner'] = 'cannot_find';; 
    //         array[index]['owner'] = owner.username;
    //     }));
    //     return projects
    // }catch(err){
    //     console.log(err);
    //     return {error:err}
    // }

    //using users/batch
    if(!projects||!projects.projects) return projects;
    user_ids = projects.projects.map(project=>project.owner_id)
    req = requestBuilder(api_host, api_types.usersbatch,{api_key:api_key,ids:user_ids.join(',')});
    try{
        const res = await fetch(req);
        const json = await res.json();
        if(!json||!json.users) {
            console.log('unable to get users list');
            return projects
        }
        const usernames = await json.users.map(user=>user.username);
        projects.projects.forEach(function(project,index,array){
            owner = usernames[index];
            if(!owner) array[index]['owner'] = 'cannot_find';
            else array[index]['owner'] =  owner; 
        });
        return projects;
    }catch(err){
        console.log(err);
        return {error:err};
    }


}

app.use(sassMiddleware({
    src:path.join(__dirname,'sass'),
    dest:path.join(__dirname,'public'),
    force:true
}));
app.use('/public',express.static(path.join(__dirname,'public')));

app.set('view engine', 'ejs');

app.get('/user/:id', async function(req,res){
    id = req.params.id;
    if (!/^\d+$/.test(id)){
        res.json({error:'invalid id format'})
        return
    }
    info = await getUser(id);
    if(!info||!info.username){
        res.json({error:'user not exist'})
        return
    }
    res.json(info)
})


app.get('/projects/:page', async function(req,res){
    page = req.params.page
    if (!/^\d+$/.test(page)){
        res.json({error:'invalid page format'})
        return
    }
    try{
        projects = await getProjects(page);
    }catch(error){
        res.json({error:'get projects error'});
        console.log(error);
    }
    if (!projects||!projects.projects){
        res.json({error:'page cannot find/may beyound api hourly limit '})
        return
    }
    if (projects.page>projects.last_page){
        res.json({error:'page number beyound limit'})
        return
    }
    try{
        projects = await getOwners(projects);
    }catch(error){
        console.log(error)
        res.json({error:'get owners error'});
        return
    }
    res.json(projects);
})

app.get('/', async function(req,res){
    try{
        projects = await getProjects()
        projects = await getOwners(projects);
        res.render('home.ejs',{projects:projects});
    }catch(error){
        res.send({error:'error in initialzing'})
    }
});


app.get("*", function(req,res){
    res.send('invalid request');
});

app.listen(3000, 'localhost',function(){
    console.log("Server is listening");
});