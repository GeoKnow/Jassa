/**
 * Sparql endpoint class.
 * Allows execution of sparql queries against a preconfigured service
 * 
 */			
(function($) {

    var util = Jassa.util;
    
	var ns = Jassa.service;
	
	
	ns.QueryExecution = Class.create({
		execSelect: function() {
			throw "Not overridden";
		},
		
		execAsk: function() {
			throw "Not overridden";			
		},
		
		execDescribeTriples: function() {
			throw "Not overridden";
		},
		
		execConstructTriples: function() {
			throw "Not overridden";			
		},
		
		setTimeout: function(timeoutInMillis) {
			throw "Not overridden";
		}
	});
	
	
	ns.QueryExecutionHttp = Class.create(ns.QueryExecution, {
		initialize: function(queryString, serviceUri, defaultGraphUris, ajaxOptions, httpArgs) {
			this.queryString = queryString;
			this.serviceUri = serviceUri;
			this.defaultGraphUris = defaultGraphUris;
			
            this.ajaxOptions = ajaxOptions || {};
			this.httpArgs = httpArgs;
		},
		
		/**
		 * 
		 * @returns {Promise<sparql.ResultSet>}
		 */
		execSelect: function() {
			var result = this.execAny().pipe(ns.ServiceUtils.jsonToResultSet);
			return result;
		},
	
		execAsk: function() {
			var result = this.execAny().pipe(function(json) {
				return json['boolean'];
			});
			
			return result;
		},

		// Returns an iterator of triples
		execConstructTriples: function() {
		    throw 'Not implemented yet';
			//return this.execAny(queryString);
		},
	
		execDescribeTriples: function() {
		    throw 'Not implemented yet';
			//return this.execAny(queryString);
		},
		
		setTimeout: function(timeoutInMillis) {
			this.ajaxOptions.timeout = timeoutInMillis;
		},
		
		getTimeout: function() {
		    return this.ajaxOptions.timeout;
		},

		execAny: function() {

		    var ajaxSpec = ns.ServiceUtils.createSparqlRequestAjaxSpec(this.serviceUri, this.defaultGraphUris, this.queryString, this.httpArgs, this.ajaxOptions);
		    var result = $.ajax(ajaxSpec);

			return result;
		}
	});

//	
//	ns.HttpService = Class.create({
//	    exec: function(ajaxSpec) {
//	        console.log('[ERROR] Not overridden');
//	        throw 'Not overridden';
//	    }
//	});
//
//	
//	
//	
//	ns.HttpServiceRaw = Class.create({
//	    exec: function(ajaxSpec, cacheKey) {
//	        return $.ajax(ajaxSpec);
//	    }
//	});
//
//	
//	
//	ns.HttpServiceCache = Class.create(ns.HttpService, {
//	    initialize: function(executionCache, resultCache) {            
//            this.executionCache = executionCache ? executionCache : {};
//            this.resultCache = resultCache ? resultCache : new Cache();
//	    },
//	   
//	    exec: function(ajaxSpec, cacheKey) {
//	        
//	        //var ajaxSpec = this.ajaxSpec;
//	        //var cacheKey = this.cacheKey;
//	        var executionCache = this.executionCache;
//	        var resultCache = this.resultCache;
//	        
//            var result = executionCache[cacheKey];
//            
//            if(!result) {
//                // Check if there is an entry in the result cache
//                var str = resultCache.getItem(cacheKey);
//                
//                if(str) {                     
//                    //console.log('[DEBUG] QueryCache: Reusing cache entry for cacheKey: ' + cacheKey);
//                    var deferred = $.Deferred();
//                    var data = JSON.parse(str);
//                    deferred.resolve(data);
//                    result = deferred.promise();
//                }
//                else {
//                    var request = $.ajax(ajaxSpec);
//                    
//                    result = request.pipe(function(data) {
//                        resultCache.setItem(cacheKey, data);
//                        return data;
//                    });
//                    
//                    executionCache[cacheKey] = result;
//                }
//            }
//            
//            return result;
//	    }
//	});

	
	/**
	 * A query execution that does simple caching based on the query strings.
	 * 
	 * 
	 */
    ns.QueryExecutionCache = Class.create(ns.QueryExecution, {
        initialize: function(queryExecution, cacheKey, requestCache) {
            this.queryExecution = queryExecution;
             
            this.cacheKey = cacheKey;
            this.requestCache = requestCache;
        },
         
        setTimeout: function(timeoutInMillis) {
            this.queryExecution.setTimeout(timeoutInMillis);
        },

        execSelect: function() {
            var cacheKey = this.cacheKey;
             
            var requestCache = this.requestCache;
            var resultCache = requestCache.getResultCache();
            var executionCache = requestCache.getExecutionCache();

            // Check the cache whether the same query is already running
            // Re-use its promise if this is the case
             
            // TODO Reusing promises must take timeouts into account
             
            var executionPromise = executionCache[cacheKey];

            if(!executionPromise) {
                 
                // Check if there is an entry in the result cache
                var cacheData = resultCache.getItem(cacheKey);
                if(cacheData) {                     
                    var deferred = $.Deferred();
                    deferred.resolve(cacheData);
                    executionPromise = deferred.promise();
                }
                else {
                    var request = this.queryExecution.execSelect();
                     
                    var trans = request.pipe(function(rs) {
                        var cacheData = {
                            bindings: rs.getBindings(),
                            varNames: rs.getVarNames()
                        };
                         
                        return cacheData;
                    });


                    var skipInsert = false;

                    executionPromise = trans.pipe(function(cacheData) {
                        skipInsert = true;

                        delete executionCache[cacheKey]; 
                        resultCache.setItem(cacheKey, cacheData);
                         
                        return cacheData;
                    });

                    if(!skipInsert) {
                        executionCache[cacheKey] = executionPromise;
                    }
                }
            }
            else {
                // Note: Multiple query execution could happen from angular apply loops that execute too often
                // So this could indicate performance issues
                console.log('[INFO] Joined query execution for: ' + cacheKey);
            }

            var result = executionPromise.pipe(function(cacheData) {
                var rs = ns.QueryExecutionCache.createResultSetFromCacheData(cacheData);
                return rs;
            });
            
            return result;
        } 
    });

    ns.QueryExecutionCache.createResultSetFromCacheData = function(cacheData) {
        var itBinding = new util.IteratorArray(cacheData.bindings);
        var varNames = cacheData.varNames;
        var rs = new ns.ResultSetArrayIteratorBinding(itBinding, varNames);

        return rs;
    };
	
})(jQuery);
