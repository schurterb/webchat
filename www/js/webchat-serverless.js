let webchatServerless = {
    
    aws: AWS,
    
    client_id: '4c79vdrft3cdt70eh5po9ukeas',
    room_id: null,
    room_password: null,
    token: "",
    userid: "",
    encoder: new TextEncoder("utf-8"),
    decoder: new TextDecoder("utf-8"),
    
    is_logged_in: false,
    room_id: "",
    
    retry_attempts: 0,
    max_retry_attempts: 5,
    
    initialize: function() {
        webchatServerless.aws.config.region = 'us-east-1'; // Region
        webchatServerless.aws.config.credentials = new webchatServerless.aws.CognitoIdentityCredentials({
            IdentityPoolId: webchatServerless.id_pool_id
        });
    },
    
    joinRoom: async function( room_id, room_password ) {
      
      webchatServerless.room_id = room_id;
      webchatServerless.room_password = room_password;
      
      //TODO: Add identity_pool creation process to this
      
      var room_exists = await webchatServerless.initializeRoom(room_id, room_password);
      if(room_exists) {
        var room_token = await webchatServerless.accessRoom(room_id, room_password);
        if(typeof room_token === 'string' || room_token instanceof String) {
          webchatServerless.is_logged_in = true;
          webchatServerless.room_id = room_id;
        }
      }
    },
    
    initializeRoom: function( room_id, room_password ) {
      
      return new Promise(function (resolve, reject) {
        var params = {
          ClientId: webchatServerless.client_id,
          Password: room_password,
          Username: room_id,
          UserAttributes: [
            {
              Name: 'name',
              Value: room_id
            },
            {
              Name: 'nickname',
              Value: room_id
            }
          ]
        };
        console.log("Registering "+room_id);
        
        cognitoidentityserviceprovider = new webchatServerless.aws.CognitoIdentityServiceProvider({apiVersion: '2016-04-18'});
        cognitoidentityserviceprovider.signUp(params, async function(err, data) {
          if (err) {
            console.log(err.message);
            if(err.message == "User already exists" || err.message == "User Already Exists") {
              resolve(true);
            } else {
              resolve(false);
            }
          } else {
            resolve( await webchatServerless.confirmRoom(room_id, room_password) );
          }
        });
      });
    },
    
    confirmRoom: async function( room_id, room_password ) {
      return new Promise(function (resolve, reject) {
        console.log("Confirming "+room_id);
        cognitoidentityserviceprovider = new webchatServerless.aws.CognitoIdentityServiceProvider({apiVersion: '2016-04-18'});
        var params = {
          UserPoolId: webchatServerless.user_pool_id,
          Username: room_id
        };
        cognitoidentityserviceprovider.adminConfirmSignUp(params, function(err, data) {
          if (err) {
            if(webchatServerless.retry_attempts < webchatServerless.max_retry_attempts) {
              console.log("Credentials not correctly initialized. Starting re-attempt "+webchatServerless.retry_attempts+" of "+webchatServerless.max_retry_attempts);
              webchatServerless.retry_attempts += 1;
              webchatServerless.initialize();
              webchatServerless.initializeRoom(room_id, room_password);
              resolve(true);
            } else {
              console.log(err);
              resolve(false);
            }
          } // an error occurred
          else { 
            resolve(true);
          }
        });
      });
    },
    
    accessRoom: function( room_id, room_password ) {
      
      return new Promise(function (resolve, reject) {
        console.log("Logging into "+room_id);
        var params = {
          AuthFlow: 'USER_PASSWORD_AUTH',
          ClientId: webchatServerless.client_id,
          AuthParameters: {
            'USERNAME': room_id,
            'PASSWORD': room_password
          }
        }
        cognitoidentityserviceprovider = new webchatServerless.aws.CognitoIdentityServiceProvider({apiVersion: '2016-04-18'}),
        cognitoidentityserviceprovider.initiateAuth(params, async function(err, data) {
          if (err) {
            console.log(err.message);
            if(err.message == "User is not confirmed." && (webchatServerless.retry_attempts < webchatServerless.max_retry_attempts)) {
              webchatServerless.retry_attempts += 1;
              if( await webchatServerless.confirmRoom(room_id, room_password) ) {
                resolve(await webchatServerless.accessRoom(room_id, room_password));
              }
            }
            reject();
          } else {
            webchatServerless.token = data.AuthenticationResult.IdToken;
            webchatServerless.aws.config.credentials = new webchatServerless.aws.CognitoIdentityCredentials( {
                IdentityPoolId: webchatServerless.id_pool_id,
                Logins: {
                  'cognito-idp.us-east-1.amazonaws.com/us-east-1_Ez8dIP9Xb': webchatServerless.token
                }
            });
            console.log("Login complete.");
            var sts = new webchatServerless.aws.STS({sts: '2011-06-15',});
            var params = {
            };
            sts.getCallerIdentity(params, function(err, data) {
              if (err) {
                reject(err);
              } else{
                webchatServerless.userid = data.UserId;
                resolve(webchatServerless.token);
                console.log("Retrieved userid.");
              }
            });
          }
        });
      });
    },
    
    listFiles: function() {
      if(webchatServerless.is_logged_in) {
        return new Promise(function (resolve, reject) {
          var s3 = new webchatServerless.aws.S3({apiVersion: '2006-03-01'});
          var listObjectsParams = {
            Bucket: "web-dev-20210201", 
            MaxKeys: 10,
            Prefix: 'rooms/'+webchatServerless.userid
          };
          s3.listObjects(listObjectsParams, function(err, data) {
            if (err) {
              reject(err);
            } else {
              var key_list = []
              for( var i=0; i<data.Contents.length; i++) {
                var split_key = data.Contents[i].Key.split("/");
                key_list.push(split_key[split_key.length -1]);
              }
              resolve(key_list);
            }
          });
        });
      } else {
        console.log("Must be in a room before files can be written or read.");
      }
    },
    
    getFile: function(filename) {
      if(webchatServerless.is_logged_in) {
        return new Promise(function (resolve, reject) {
          var s3 = new webchatServerless.aws.S3({apiVersion: '2006-03-01'});
            var getObjectParams = {
              Bucket: "web-dev-20210201", 
              Key: "rooms/"+webchatServerless.userid+"/"+filename
            };
            s3.getObject(getObjectParams, function(err, data) {
              if (err) { 
                resolve(err);
              } else {
                data.Body = webchatServerless.decoder.decode(data.Body);
                resolve(data);
              }
            });
        });
      } else {
        console.log("Must be in a room before files can be written or read.");
      }
    },
    
    createFile: function(filename, data) {
      if(webchatServerless.is_logged_in) {
        return new Promise(function (resolve, reject) {
          var s3 = new webchatServerless.aws.S3({apiVersion: '2006-03-01'});
            var putObjectParams = {
              Body: webchatServerless.encoder.encode(data), 
              Bucket: "web-dev-20210201", 
              Key: "rooms/"+webchatServerless.userid+"/"+filename,
            };
            s3.putObject(putObjectParams, function(err, data) {
              if (err) { 
                resolve(err);
              } else {
                resolve(data);
              }
            });
        });
      } else {
        console.log("Must be in a room before files can be written or read.");
      }
    },
    
    updateFile: function(filename, data) {
      return webchatServerless.createFile(filename, data);
    },
    
    deleteFile: function(filename) {
      if(webchatServerless.is_logged_in) {
        return new Promise(function (resolve, reject) {
          var s3 = new webchatServerless.aws.S3({apiVersion: '2006-03-01'});
            var deleteObjectParams = {
              Bucket: "web-dev-20210201",
              Key: "rooms/"+webchatServerless.userid+"/"+filename
            };
            s3.deleteObject(deleteObjectParams, function(err, data) {
              if (err) { 
                resolve(err);
              } else {
                resolve(data);
              }
            });
        });
      } else {
        console.log("Must be in a room before files can be written or read.");
      }
    },
    
    test: async function() {
      console.log(" ##### ##### ##### ");
      console.log("TESTING");
        
      var test_filename = "testing.txt"
      
      console.log("List existing files:")
      var output = await webchatServerless.listFiles();
      console.log(output);
      
      console.log("Add new file:");
      var output = await webchatServerless.createFile(test_filename, "Initial commit");
      console.log(output);
      
      console.log("List exsiting files:");
      var output = await webchatServerless.listFiles();
      console.log(output);
      
      console.log("Get added file:");
      var output = await webchatServerless.getFile(test_filename);
      console.log(output);
      
      console.log("Update file:");
      var output = await webchatServerless.updateFile(test_filename, "Updated commit");
      console.log(output);
      
      console.log("Get updated file:");
      var output = await webchatServerless.getFile(test_filename);
      console.log(output);
      
      console.log("Delete file:");
      var output = await webchatServerless.deleteFile(test_filename);
      console.log(output);
      
      console.log("List exsiting files:");
      var output = await webchatServerless.listFiles();
      console.log(output);
      
      console.log("TEST COMPLETE");
      console.log(" ##### ##### ##### ");
    }
}