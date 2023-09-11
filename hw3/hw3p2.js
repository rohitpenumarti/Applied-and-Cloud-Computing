const axios = require('axios');
const { EntityNotFoundError } = require('./error');
const BASE_URL = 'http://api.twitter.com/2/';

class TwitterApi {
    
    constructor(bearerToken) {
        this.twitter = axios.create({
            baseURL: BASE_URL,
            headers: {'Authorization': `Bearer ${bearerToken}`}
        });
    }

    _formatTweet(data) {
        return {
            "body": data.text,
            "createdAt": data.created_at,
            "publicMetrics": data.public_metrics,
            "tweetId": data.id,
            "userId": data.author_id
        };
    }

    _formatTweetPublicMetrics(data) {
        return {
            "retweetCount": data.public_metrics,
            "replyCount": data.public_metrics,
            "likeCount": data.public_metrics
        };
    }

    _formatUser(data) {
        return {
            "createdAt": data.created_at,
            "description": data.description,
            "location": data.location,
            "name": data.name,
            "publicMetrics": data.public_metrics,
            "userId": data.id,
            "userName": data.username,
            "verified": data.verified
        };
    }

    _formatTweet(data) {
        return {
            "body": data.text,
            "createdAt": data.created_at,
            "publicMetrics": data.public_metrics,
            "tweetId": data.id,
            "userId": data.author_id
        };
    }

    getTweet(tweetId, callback) {
        let config = {
            params: {
                'tweet.fields': 'author_id,id,public_metrics,created_at,text'
            }
        };

        let res = this.twitter.get(`/tweets/${tweetId}`, config)
            .then(response => {
                if (response.data.errors) {
                    throw new EntityNotFoundError();
                }

                let tweet_data = this._formatTweet(response.data.data);
                return tweet_data;
            })
            .then(val => callback(null, val))
            .catch(err => callback(err));
        return res;
    }

    getTimeline(userId, callback) {
        let config = {
            params: {
                'tweet.fields': 'author_id,id,public_metrics,created_at,text'
            }
        };

        let res = this.twitter.get(`/users/${userId}/tweets`, config)
            .then(response => {
                if (response.data.errors) {
                    let errObj = response.data.errors[0];
                    if (errObj['title'] == 'Authorization Error') {
                        return [];
                    } else if (errObj['title'] == 'Not Found Error' && errObj['resource_type'] != 'user') {
                        return [];
                    } else {
                        throw new EntityNotFoundError();
                    }
                }

                let tweet_data = [];
                response.data.data.forEach(element => {
                    tweet_data.push(this._formatTweet(element));
                });

                return tweet_data;

            })
            .then(val => callback(null, val))
            .catch(err => callback(err));
        return res;
    }

    recentSearch(query, callback) {
        let config = {
            params: {
                query: query
            }
        };

        let res = this.twitter.get(`/tweets/search/recent`, config)
            .then(response => {
                if (response.data.errors) {
                    throw new EntityNotFoundError();
                }

                let tweet_data = [];
                if (response.data.data) {
                    response.data.data.forEach(element => {
                        tweet_data.push(this._formatTweet(element));
                    });
                }

                return tweet_data;
            })
            .then(val => callback(null, val))
            .catch(err => callback(err));
        return res;
    }

    retweetBy(tweetId, callback) {
        let config = {};

        let res = this.twitter.get(`/tweets/${tweetId}/retweeted_by`, config)
            .then(response => {
                if (response.data.errors) {
                    let errObj = response.data.errors[0];
                    if (errObj['title'] == 'Authorization Error') {
                        return [];
                    } else if (errObj['title'] == 'Not Found Error' && errObj['resource_type'] != 'tweet') {
                        return [];
                    } else {
                        throw new EntityNotFoundError();
                    }
                }

                let tweet_data = [];
                if (response.data.data) {
                    response.data.data.forEach(element => {
                        tweet_data.push(this._formatUser(element));
                    });
                }

                return tweet_data;
            })
            .then(val => callback(null, val))
            .catch(err => callback(err));
        return res;
    }

    getUser(userId, callback) {
        let config = {};

        let res = this.twitter.get(`/users/${userId}`, config)
            .then(response => {
                if (response.data.errors) {
                    throw new EntityNotFoundError();
                }

                let tweet_data;
                if (response.data.data) {
                    tweet_data = this._formatUser(response.data.data);
                }

                return tweet_data;
            })
            .then(val => callback(null, val))
            .catch(err => callback(err));
        return res;
    }

    getUserByUsername(userName, callback) {
        let config = {
            params: {
                'user.fields': 'created_at,description,location,name,public_metrics,id,username,verified'
            }
        };

        let res = this.twitter.get(`/users/by/username/${userName}`, config)
            .then(response => {
                if (response.data.errors) {
                    throw new EntityNotFoundError();
                }

                let tweet_data;
                if (response.data.data) {
                    tweet_data = this._formatUser(response.data.data);
                }

                return tweet_data;
            })
            .then(val => callback(null, val))
            .catch(err => callback(err));
        return res;
    }

    _getUserId(userData) {
        return userData['userId'];
    }

    getTimelineByUsername(userName, callback) {
        let config = {
            params: {
                'user.fields': 'created_at,description,location,name,public_metrics,id,username,verified'
            }
        };

        let res = this.twitter.get(`/users/by/username/${userName}`, config)
            .then(response => {
                if (response.data.errors) {
                    throw new EntityNotFoundError();
                }

                let userId;
                if (response.data.data) {
                    userId = this._formatUser(response.data.data)['userId'];
                }

                let final = this.twitter.get(`/users/${userId}/tweets`, config)
                    .then(response => {
                        if (response.data.errors) {
                            throw new EntityNotFoundError();
                        }

                        let tweet_data = [];

                        response.data.data.forEach(element => {
                            tweet_data.push(this._formatTweet(element));
                        });

                        return tweet_data;
                    })
                    .then(val => callback(null, val))
                    .catch(err => callback(err));
                return final;
            })
            .then(val => callback(null, val))
            .catch(err => callback(err));
        return res;
    }
}

exports.TwitterApi = TwitterApi;