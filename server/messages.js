const _ = require('lodash');

function getMessages(req, res) {

    let messages = [{
        time: 1512464950,
        date: '5 Dec 17, 11:58',
        user: 'jonty.usborne@bbc.co.uk',
        title: 'Test Title',
        text: 'test message'
    },
    {
        time: 1512464951,
        date: '5 Dec 17, 11:58',
        user: 'jonty.usborne@bbc.co.uk',
        title: 'Software Update',
        text: "<ul><li>Your drafts are now saved, so you can go back and edit them &#x1F389;</li><li>Your audiograms and drafts are now (optionally, but by default) shared with other users under 'Recent Projects'</li></ul>"
    }];

    messages = _.sortBy(messages, 'time').reverse();

    return res.json({ messages });

};


function editor(req, res) {
    const path = require("path")
    const messagesPage = path.join(__dirname, "../editor/messages.html");
    return res.sendFile(messagesPage);
}

module.exports = {
    getMessages,
    editor
}