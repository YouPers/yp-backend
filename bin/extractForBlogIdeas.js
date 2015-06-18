#!/usr/local/bin/node

/**
 * Module dependencies.
 */
var program = require('commander'),
    config = require('../src/config/config'),
    mongoose = require('ypbackendlib').mongoose,
    restify = require("restify"),
    marked = require('marked'),
    async = require('async'),
    path = require('path'),
    temp = require('temp').track();

marked.setOptions({
    renderer: new marked.Renderer(),
    gfm: false,
    tables: true,
    breaks: true,
    pedantic: false,
    sanitize: false,
    smartLists: true,
    smartypants: false
});

var https = require('https');
var request = require('request');
var fs = require('fs');

require('../src/util/database').initializeDb();

program
    .version('0.0.1')
    .usage('')
    .parse(process.argv);

var client = restify.createJsonClient({
    url: config.healthCampaignBlog.url,
    version: '*'
});

client.basicAuth(config.healthCampaignBlog.username, config.healthCampaignBlog.password);

var languages = config.healthCampaignBlog.blogLanguages;

var basePath = config.healthCampaignBlog.basePath;

var getRandomInt = function (min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

var formatLog = function(language, step) {
    return language + ' ' + step + ': ';
}

var formatHTML = function (key, value) {
    if (typeof value === "string") {
        value = value.replace('<br>', ' '); // needed to replace any line breaks in titles
        value = value.replace('&quot;', '"'); // needed, as auto posting to Twitter and Facebook would display the code instead of the special character
        value = value.replace(/(?:\r\n|\r|\n)/g, '<br />'); // replace newlines with line breaks
    }
    return value;
};

var markToHTML = function (value) {
    return marked (value);
}

console.log ('');

async.each (languages, function(language, blogForLanguageProcessed) {

    var ideasOID = [];

    var ideaToPost;

    var imageURL;

    var tempDirPath;

    var imageFileName;

    var tempImageFileName;

    var imageFileStream;

    var returnedBody;

    var pictureID;

    var wpPostID;

    var processingStep = 0;

    console.log(formatLog(language, processingStep) + 'Language to work on: ' + language);
    console.log ('');

    async.series([

            // get already posted ideas

            function(allPostedIdeasFound) {

                processingStep++;

                client.get(basePath + '?type[]=post&filter[post_status]=publish' + '&filter[nopaging]=true' + '&lang=' + language, function(err, req, res, obj) {

                    if (err) {
                        return allPostedIdeasFound(err);
                    }

                    var nOfFoundPosts = obj.length;

                    console.log (formatLog(language, processingStep) + 'Number of found posts: %d', nOfFoundPosts);
                    console.log ('');

                    var counter = 0;

                    // for each found post retrieve the associated idea OID

                    async.eachSeries(obj, function (foundPost, foundPostScanned) {

                        var foundPostID = foundPost.ID;

                        // retrieve idea oid of each post

                        client.get(basePath + '/' + foundPostID + '/meta', function (err, req, res, obj) {

                            //console.log (formatLog(language, processingStep) + 'Meta Data of %d: %s', nOfFoundPosts, JSON.stringify(obj));
                            //console.log ('');

                            counter++;

                            var filteredMeta = obj.filter(function oidEntry(el) {
                                return el.key === 'yp_idea_oid';
                            });

                            if (filteredMeta.length > 0) {
                                if (filteredMeta[0].value) {
                                    ideasOID.push({ "_id": filteredMeta[0].value});
                                }
                            }

                            if (counter < nOfFoundPosts) {

                                //console.log (' counter: ' + counter);

                            } else {

                                // we have scanned all found posts

                                if (ideasOID.length === 0) {
                                    // add a fake id in order to avoid getting a MongoError when no Ideas have been posted yet (initial load)
                                    ideasOID.push({ "_id": "0000aaaaaaaaa00a00000000"});
                                }

                                console.log (formatLog(language, processingStep) + 'Already posted ideas: %s', JSON.stringify(ideasOID));
                                console.log('');

                                // we call the callback function to state that this subtask is completed

                                //foundPostScanned();
                                allPostedIdeasFound();

                            }

                        });

                        foundPostScanned();

                    });

                });
            },
            function(newIdeaToPostFound) {

                // get Ideas which have not yet been posted

                processingStep++;

                mongoose
                    .model('Idea')
                    .find({ "source": "youpers" })  // all YouPers Ideas
                    .nor(ideasOID)            // which are not already posted
                    .select()
                    .populate('topics')
                    .exec(function(err, ideas) {
                        if (err) {
                            console.log (formatLog(language, processingStep) + 'MongoDB Error: %s', JSON.stringify(err));
                            return;
                        }

                        // take randomly a not yet posted idea with
                        // - at least one topic
                        // - existing language entries for title, description and text
                        // and post it

                        var idea = ideas[getRandomInt(0, ideas.length)];
                        var nOfTopics = idea.topics.length;

                        console.log (formatLog(language, processingStep) + 'Found Idea (Number): %s', JSON.stringify(idea.number));
                        console.log(' ');

                        while ((nOfTopics < 1) ||
                        (idea.titleI18n[language] === undefined) ||
                        (idea.descriptionI18n[language] === undefined) ||
                        (idea.textI18n[language] === undefined)) {
                            console.log (formatLog(language, processingStep) + 'Discarded Idea (Number): %s', JSON.stringify(idea.number));
                            console.log(' ');
                            idea = ideas[getRandomInt(0, ideas.length)];
                            nOfTopics = idea.topics.length;
                            console.log (formatLog(language, processingStep) + 'Found Idea (Number): %s', JSON.stringify(idea.number));
                            console.log(' ');
                        }

                        ideaToPost = idea;
                        imageURL = idea.picture;
                        imageFileName = idea.number + '.jpg';

                        console.log (formatLog(language, processingStep) + 'Selected Idea (Number): %s', JSON.stringify(idea.number));
                        console.log(' ');

                        newIdeaToPostFound();

                        //mongoose.disconnect();

                    });

            },
            function(temporaryDirectoryCreated) {

                // create a temporary directory to store image file to be downloaded from AWS and uploaded to WordPress

                processingStep++;

                temp.mkdir('imageDirectory', function(err, dirPath) {
                    tempDirPath = dirPath;

                    console.log (formatLog(language, processingStep) + 'Temporary directory created: %s', tempDirPath);
                    console.log(' ');

                    temporaryDirectoryCreated();
                });

            },
            function(imageFileDownLoaded) {

                // get remote image to be used as featured image

                processingStep++;

                console.log (formatLog(language, processingStep) + 'Image to download: ' + imageURL);
                console.log(' ');

                tempImageFileName = path.join(tempDirPath, imageFileName);

                console.log (formatLog(language, processingStep) + 'Temporary file name: ' + tempImageFileName);
                console.log(' ');

                imageFileStream = fs.createWriteStream(tempImageFileName);

                https.get(imageURL, function(response) {
                    response.pipe(imageFileStream);
                    imageFileStream.on('finish', function() {

                        console.log(formatLog(language, processingStep) + 'Image downloaded');
                        console.log(' ');

                        imageFileStream.close(imageFileDownLoaded());  // close() is async, call cb after close completes.
                    });
                }).on('error', function(err) { // Handle errors
                    fs.unlink(tempImageFileName); // Delete the file async. (But we don't check the result)
                    console.log(formatLog(language, processingStep) + 'Image could not be downloaded: ' + imageURL + ' Error: ' +err.message);
                    console.log(' ');
                    imageFileDownLoaded(err);
                });

            },
            function (imageFileUploaded) {

                // upload image

                processingStep++;

                var username = config.healthCampaignBlog.username,
                    password = config.healthCampaignBlog.password,
                    url = 'http://' + username + ':' + password + '@healthcampaign.youpers.com/wp-json/media';

                console.log(formatLog(language, processingStep) + 'url: ' + url);
                console.log('');

                var r = request.post(url, function (err, httpResponse, body) {
                    if (err) {
                        return console.error(language + ' - Image upload failed:', err);
                    }
                    console.log(formatLog(language, processingStep) + 'Image upload successful');
                    console.log('');
                    console.log(formatLog(language, processingStep) + 'Body: ' + JSON.stringify(body));
                    console.log('');

                    returnedBody = JSON.parse(body);

                    pictureID = returnedBody.ID;

                    fs.unlink(tempImageFileName, function (err) {
                        if (err) {
                            console.log(formatLog(language, processingStep) + 'Delete of temporary image file failed: ' + tempImageFileName);
                            console.log('');
                        }
                        console.log(formatLog(language, processingStep) + 'Temporary image file deleted: ' + tempImageFileName);
                        console.log('');

                        imageFileUploaded();

                    });


                });

                var form = r.form();
                form.append('name', 'file');
                form.append('filename', imageFileName);
                form.append('file', fs.createReadStream(tempImageFileName));


            }, function (blogPostCreated) {

                // Now, after having uploaded the featured image, post the blog entry

                processingStep++;

                var blog_content = "[yp_post_rich_snippets lang='" + language + "' " +
                    "name=" + JSON.stringify(ideaToPost.number) + " " +
                    "imgsrc=" + JSON.stringify(ideaToPost.picture) + " " +
                    "title=" + JSON.stringify(markToHTML(ideaToPost.titleI18n[language]),formatHTML) + " " +
                    "headline=" + JSON.stringify(markToHTML(ideaToPost.descriptionI18n[language]),formatHTML) + " " +
                    "body=" + JSON.stringify(markToHTML(ideaToPost.textI18n[language]),formatHTML) + " " +
                    "topic='Stress' " +
                    "published='2015-02-05T08:00:00+08:00']";

                client.post(basePath + '?lang=' + language, {
                    title: ideaToPost.titleI18n[language].replace('<br>', ' '),
                    content_raw: blog_content,
                    excerpt_raw: ideaToPost.descriptionI18n[language].replace('<br>', ' '),
                    status: "publish",
                    comment_status: "closed",
                    date_gmt: new Date(new Date().setHours(6, 0, 0, 0)).toISOString()
                }, function (err, req, res, obj) {
                    if (err) {
                        console.log(formatLog(language, processingStep) + "Posting the blog entry failedE: " + JSON.stringify(err));
                        console.log('');
                        blogPostCreated(err);
                    }

                    console.log(formatLog(language, processingStep) + "Posting blog status: " + '%d', res.statusCode);
                    console.log('');

                    wpPostID = obj.ID;

                    console.log(formatLog(language, processingStep) + "WordPress Post ID: " + wpPostID);
                    console.log('');
                    console.log(formatLog(language, processingStep) + "WordPress Featured Image ID: " + pictureID);
                    console.log('');

                    blogPostCreated();

                });

            },
            function (blogPostMetaDataCreated) {

                // create meta data entries for blog post

                processingStep++;

                var metaData = [];

                metaData.push({key: "qode_animate-page-title", value: "no"});
                metaData.push({key: "qode_show-sidebar", value: "1"});
                metaData.push({key: "qode_header-style", value: "dark"});
                metaData.push({key: "qode_enable_breadcrumbs", value: "no"});
                metaData.push({key: "qode_title-height", value: 200});
                metaData.push({key: "qode_enable_content_bottom_area", value: "yes"});
                metaData.push({key: "qode_choose_content_bottom_sidebar", value: "Start-Campaign-" + language});
                metaData.push({key: "qode_content_bottom_sidebar_in_grid", value: "no"});
                metaData.push({key: "qode_responsive-title-image", value: "no"});
                metaData.push({key: "qode_page_title_font_size", value: "large"});
                metaData.push({key: "qode_title_text_shadow", value: "no"});
                metaData.push({key: "qode_fixed-title-image", value: "no"});
                metaData.push({key: "qode_choose-sidebar", value: "Blog-Sidebar-" + language});
                metaData.push({
                    key: "qode_title-image",
                    value: "http://healthcampaign.youpers.com/wp-content/uploads/2015/04/HealthCampaignHeader2003.jpg"
                });
                metaData.push({key: "yp_idea_oid", value: ideaToPost._id});
                metaData.push({key: "yp_idea_oid_updated", value: ideaToPost.updated});
                metaData.push({key: "yp_thumbnail_ID", value: pictureID});

                // topics associated with idea will be used as WordPress blog categories

                var topicsString = '';

                for (var i = 0; i < ideaToPost.topics.length; i++) { // for (var i in topics) doesn't work...

                    topicsString += ideaToPost.topics[i].name.toLowerCase() + '-' + language + ',';

                }

                metaData.push({key: "yp_categories", value: topicsString});

                var counter = 0;

                async.eachSeries(metaData, function (metaDataItem, blogPostMetaDataItemCreated) {

                    client.post(basePath + '/' + wpPostID + '/meta', metaDataItem, function (err, req, res, obj) {
                        if (err) {
                            console.log(formatLog(language, processingStep) + "Creating meta entry for blog failed: " + JSON.stringify(err));
                            console.log('');
                            blogPostMetaDataItemCreated(err);
                        }
                        counter++;
                        console.log(formatLog(language, processingStep) + "Creating meta entry status: " + '%d', res.statusCode);
                        console.log('');

                        if (counter < metaData.length) {
                        } else {
                            //blogPostMetaDataItemCreated();
                            blogPostMetaDataCreated();
                        }

                        blogPostMetaDataItemCreated();
                    });

                });
            }
        ],
        function(err) {
            if (err) {
                console.log ('Something went wrong!');
                console.log('');
                return;
            }

            processingStep++;

            console.log('');
            console.log(formatLog(language, processingStep) + 'Blog Entry for language ' + language + ' done.');
            console.log('');
            blogForLanguageProcessed();
        });


}, function (err) {
    if( err ) {
        console.log('');
        console.log('Something went wrong!');
        console.log('');
    } else {
        console.log('');
        console.log('Blog Entries for all languages created.');
        console.log('');
        process.exit();
    }
});
