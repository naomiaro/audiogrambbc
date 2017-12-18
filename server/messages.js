const _ = require("lodash");
const uuidv4 = require("uuid/v4");
const async = require('async');

const redisHost = require("../settings/").redisHost;
const redis = require("redis");
const redisClient = redis.createClient({ host: redisHost });
redisClient.on("error", function(err) {
  console.log("REDIS ERROR>> ", err);
});

function fetchReadCount(id, cb) {
    redisClient.get(`audiogram:messages:readcount:${id}`, cb);
}

function getMessages(req, res) {

    const since = req.params.since;
    const now = Date.parse(new Date());

    redisClient.smembers(`audiogram:messages`, (err, messages) => {
        messages = messages.map((message) => {
            return JSON.parse(message);
        });
        messages = _.sortBy(messages, "date").reverse();
        if (_.isUndefined(since)) {
            // Admin view
            const ids = messages.map((message) => message.id);
            async.map(ids, fetchReadCount, (err, readCounts) => {
              messsages = messages.map((message, i) => {
                message.readCount = readCounts[i] || 0;
              });
              return res.json({ messages });
            });
        } else {
            // User view
            messages = messages.filter((message) => {
                const date = Date.parse(message.date);
                const expires = Date.parse(message.expire);
                if (expires < now || date < since) return false;
                redisClient.incr(`audiogram:messages:readcount:${message.id}`);
                return true;
            });
            return res.json({ messages });
        }
	});

    // let messages = [{
    //     time: 1512464950,
    //     date: '5 Dec 17, 11:58',
    //     user: 'jonty.usborne@bbc.co.uk',
    //     title: 'Test Title',
    //     text: 'test message'
    // },
    // {
    //     time: 1512464951,
    //     date: '5 Dec 17, 11:58',
    //     user: 'jonty.usborne@bbc.co.uk',
    //     title: 'Software Update',
    //     text: "<ul><li>Your drafts are now saved, so you can go back and edit them &#x1F389;</li><li>Your audiograms and drafts are now (optionally, but by default) shared with other users under 'Recent Projects'</li></ul>"
    // }];


};

function expire(req, res) {
    const id = req.params.id;
    const expire = Date.parse(new Date()) - 1000;
    redisClient.smembers(`audiogram:messages`, (err, messages) => {
        messages = messages.map((message) => {
            return JSON.parse(message);
        });
        messages.forEach(message => {
            if (message.id == id) {
                updatedMessage = Object.assign({}, message);
                updatedMessage.expire = new Date(expire);;
                redisClient.multi()
                    .srem('audiogram:messages', JSON.stringify(message))
                    .sadd('audiogram:messages', JSON.stringify(updatedMessage))
                    .exec((err, msg) => {
                        return res.json(msg);
                    });
            }
        });

    });
}

function editor(req, res) {
    const path = require("path")
    const messagesPage = path.join(__dirname, "../editor/messages.html");
    return res.sendFile(messagesPage);
}

function add(req, res) {
    const message = req.body;
    message.id = uuidv4();
    message.user = req.header('BBC_IDOK') ? req.header('BBC_EMAIL') : 'localhost@audiogram.newslabs.co';
    message.date = new Date(Date.parse(message.date));
    message.expire = new Date(Date.parse(message.expire));
    redisClient.sadd(`audiogram:messages`, JSON.stringify(message));
    res.json(message);
}

module.exports = {
    getMessages,
    editor,
    add,
    expire
}