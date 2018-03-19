const functions = require('firebase-functions');
const admin = require('firebase-admin');
const express = require("express")

admin.initializeApp(Object.assign({}, functions.config().firebase, {
    databaseAuthVariableOverride: {
        uid: 'cloud-functions'
    }
}));

const db = admin.database();
const posts = express();

var validateUsernameHeader = function (request, response, next) {
    if (!request.header('username')) { return response.send(403); }

    next();
};

posts.use(validateUsernameHeader);

posts.get('/', (request, response) => {
    return db.ref(`posts`).once('value').then(snapshot => {
        if (!snapshot.val()) { return response.json([]); }

        const username = request.headers.username;
        const posts = [];

        snapshot.forEach(post => {
            posts.push(Object.assign({
                likes: {}
            }, post.val(), {
                is_liked: post.child(`likes/${username}`).exists() || false
            }));
        });

        return response.json(posts);
    });
});

posts.post('/', (request, response) => {
    if (!request.body.topic || !request.body.content) { return response.send(400); }

    const username = request.headers.username;

    return db.ref('posts').orderByKey().limitToLast(1).once('value').then(snapshot => {
        let nextId = 1;
        if (snapshot.val()) {
            const keys = Object.keys(snapshot.val());
            nextId = keys.length ? snapshot.val()[keys[0]].id + 1 : 1;
        }

        db.ref(`posts/${nextId}`).set({
            id: nextId,
            author: username,
            topic: request.body.topic,
            content: request.body.content
        });

        return response.send(201);
    })
});

posts.delete('/:id/', (request, response) => {
    if (!request.params.id) { return response.send(404); }

    const postId = request.params.id;
    const username = request.headers.username;

    db.ref(`posts/${postId}`).once('value', snapshot => {
        if (!snapshot.val()) { return response.send(404); }

        if (snapshot.val().author !== username) { return response.send(403); }

        db.ref(`posts/${postId}`).remove();

        response.send(204);
    });
});

posts.post('/:id/likes/', (request, response) => {
    if (!request.params.id) { return response.send(404); }

    const postId = request.params.id;
    const username = request.headers.username;

    db.ref(`posts/${postId}`).once('value', snapshot => {
        if (!snapshot.val()) { return response.send(404); }

        db.ref(`posts/${postId}/likes/${username}`).set(true);

        response.send(200);
    });
});

posts.delete('/:id/likes', (request, response) => {
    if (!request.params.id) { return response.send(404); }

    const postId = request.params.id;
    const username = request.headers.username;

    db.ref(`posts/${postId}`).once('value', snapshot => {
        if (!snapshot.val()) { return response.send(404); }

        db.ref(`posts/${postId}/likes/${username}`).remove();

        response.send(204);
    });
});

exports.posts = functions.https.onRequest(posts);
