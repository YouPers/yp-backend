Error Handling
==============

# Frontend

## Event Listener

    $scope.$emit('notification', message, {
        type: 'info', // one of error, warn, info, log, debug
        values: {
            // translation values
        });

## Success/Error Events

    message = localization key, prefixed by notification { success: { message: 'yeah' }, error: { message: 'sorry' } }


    $scope.$emit('notification:success', 'save', { type='warn', values: { name='test' } });

    # notification.success.save: "{{name}} saved"

    $scope.$emit('notification:error', err);
    $scope.$emit('notification:error', 'dateRange.invalid');

    # notification.error.dateRange.invalid: "nope"

## Log - without user feedback

    $scope.$emit('notification:log', 'comment', { comment: comment );


# Backend


## Generic handler

    if(err) {
        return error.handleError(err, next);
    }

## Rest Errors

    see error.js for a list of error codes

    usage: RestError(message, cause)

    return next(new error.MissingParameterError({
        required: 'id'
    }));


## Error Logging API

POST /error

    error: {
      "0": "notification.error.loginFailed",
      "1": {
        "error": {
          "data": {
            "message": "The request requires user authentication.",
            "code": "UnauthorizedError"
          },
          "status": 401,
          "config": {
            "method": "POST",
            "transformRequest": [
              null
            ],
            "transformResponse": [
              null
            ],
            "headers": {
              "Accept": "application/json, text/plain, */*",
              "yp-language": "de",
              "Authorization": "Basic Og==",
              "Content-Type": "application/json;charset=utf-8"
            },
            "url": "http://localhost:8000/login",
            "data": {
              "username": ""
            }
          }
        },
        "type": "error"
      }
    }
    --
    client: {
      "location": "http://localhost:9000/#/home",
      "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/30.0.1599.101 Safari/537.36",
      "headers": {
        "request-id": "07137a50-9fb9-11e3-b5d7-e3d6f6534e5c",
        "content-type": "application/json"
      },
      "requestId": "07137a50-9fb9-11e3-b5d7-e3d6f6534e5c",
      "error": {
        "message": "The request requires user authentication.",
        "code": "UnauthorizedError"
      }
    }

