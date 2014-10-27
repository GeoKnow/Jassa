// this file contains stuff that yet needs to be added to jassa core

(function() {
    
	var rdf = jassa.rdf;
	var vocab = jassa.vocab;
	var sparql = jassa.sparql;
    var service = jassa.service;
	var sponate = jassa.sponate;
    var facete = jassa.facete;
	var geo = jassa.geo;
	var util = jassa.util;
	
	var client = Jassa.client;



	var ns = service;

	
	ns.LookupServiceSparqlQuery = Class.create(ns.LookupServiceBase, {
	    initialize: function(sparqlService, query, v) {
	        this.sparqlService = sparqlService;
	        this.query = query;
	        this.v = v;
	    },

	    /**
	     * @param uris An array of rdf.Node objects that represent URIs
	     */
	    lookup: function(uris) {
	        var v = this.v;
	        var result;
	        if(uris.length === 0) {
	            result = jQuery.Deferred();
	            result.resolve(new util.HashMap());
	        } else {
	            var q = this.query.clone();

	            var filter = new sparql.ElementFilter(new sparql.E_OneOf(new sparql.ExprVar(v), uris));

	            var element = new sparql.ElementGroup([q.getQueryPattern(), filter]);
	            q.setQueryPattern(element);

	            var qe = this.sparqlService.createQueryExecution(q);
	            result = qe.execSelect().pipe(function(rs) {
	                var r = ns.ResultSetUtils.partition(rs, v);
	                return r;
	            });

	            return result;
	        }
	    }
	});
	
	/**
     * Returns an object:
     * {
     *    limit:
     *    offset:
     *    subLimit:
     *    subOffset:
     * }
     *
     */
    ns.PageExpandUtils = {
        computeRange: function(limit, offset, pageSize) {
            // Example: If pageSize=100 and offset = 130, then we will adjust the offset to 100, and use a subOffset of 30  
            var o = offset || 0;
            var subOffset = o % pageSize;
            o -= subOffset;
         
         
            // Adjust the limit to a page boundary; the original limit becomes the subLimit
            // And we will extend the new limit to the page boundary again.
            // Example: If pageSize=100 and limit = 130, then we adjust the new limit to 200
            var l = limit;
            var subLimit;
            if(l) {
                subLimit = l;
             
                var tmp = l % pageSize;
                l += pageSize - tmp;
            }
	    
            var result = {
                limit: l,
                offset: o,
                subLimit: subLimit,
                subOffset:subOffset
            };

            return result;
        }
	};
	
	ns.ListServicePageExpand = Class.create(ns.ListService, {
	    initialize: function(listService, pageSize) {
	        this.listService = listService;
	        this.pageSize = pageSize;
	    },

	    fetchItems: function(concept, limit, offset) {
	        var x = ns.PageExpandUtils.computeRange(limit, offset, this.pageSize);
	        
	        var p = this.listService.fetchItems(concept, x.limit, x.offset);
	        var result = p.pipe(function(items) {

	            var end = x.subLimit ? x.subOffset + x.subLimit : bindings.length;
                var r = items.slice(x.subOffset, end); 
	            
                return r;
	        });
	        
	        return result;
	    },
	    
	    fetchCount: function(concept, itemLimit, rowLimit) {
	        var result = this.listService.fetchCount(concept, itemLimit, rowLimit);
	        return result;
	    }
	});

	/*
	sparql.BindingUtils = {
	    partition: function(bindings, v) {
	        
	    }
	},
	*/
	
	
    ns.ResultSetPart = Class.create({
        initialize: function(varNames, bindings) {
            this.varNames = varNames || [];
            this.bindings = bindings || [];
        },

        getVarNames: function() {
            return this.varNames;
        },
        
        getBindings: function() {
            return this.bindings;
        },
                
        toString: function() {
            return 'ResultSetPart: vars=' + this.varNames + ', bindings=' + this.bindings;
        }
    });
     	
	ns.ResultSetUtils = {
	    partition: function(rs, v) {
	        var varNames = rs.getVarNames();
	        //var result = {};
	        var result = new util.HashMap();
	        
	        while(rs.hasNext()) {
	            var binding = rs.next();
	            var val = binding.get(v);
	            
	            var rsp = result.get(val);
	            if(rsp == null) {
	                rsp = new service.ResultSetPart(varNames);
	                result.put(val, rsp);
	            }
	            
	            rsp.getBindings().push(binding);
	        }
	        
	        return result;
	    },

	    createResultSetFromBindings: function(bindings, varNames) {
            var it = new util.IteratorArray(bindings);
            var result = new service.ResultSetArrayIteratorBinding(it, varNames);
	        
            return result;
	    },
	    
	    createEmptyResultSet: function(query) {
	        var vars = query.getProjectVars();
	        var varNames = sparql.VarUtils.getVarNames(vars);
	        
	        var result = this.createResultSetFromBindings([], varNames);
	        return result;
	    }
	};
	

	facete.ConceptUtils.createAttrQuery = function(attrQuery, attrVar, isLeftJoin, filterConcept, limit, offset) {

        // If no left join: clone the attrQuery, rename variables in filterConcept, add the renamed filter concept to the query
        // If left join: 
        var attrConcept = new facete.Concept(new sparql.ElementSubQuery(attrQuery), attrVar);
        
        
        var renamedFilterConcept = facete.ConceptUtils.createRenamedConcept(attrConcept, filterConcept);
        
        var newFilterElement;
        
        var requireSubQuery = limit != null || offset != null;

        if(requireSubQuery) {
            var subQuery = facete.ConceptUtils.createQueryList(renamedFilterConcept, limit, offset);
            newFilterElement = new sparql.ElementSubQuery(subQuery);
        }
        else {
            newFilterElement = renamedFilterConcept.getElement();
        }
        
        var query = attrQuery.clone();
        
        var attrElement = query.getQueryPattern();
        
        var newAttrElement;
        if(!filterConcept || filterConcept.isSubjectConcept()) {
            newAttrElement = attrElement;
        }
        else {
            if(isLeftJoin) {
                newAttrElement = new sparql.ElementGroup([
                    newFilterElement,
                    new sparql.ElementOptional(attrElement)
                ]);
            } else {
                newAttrElement = new sparql.ElementGroup([
                    attrElement,
                    newFilterElement
                ]);
            }
        }
        
        query.setQueryPattern(newAttrElement);

        //console.log('Query: ' + query);	    
        return query;
	};
	
	/**
	 * A list service that is configured with a query + var, 
	 * and which can filter the result set according to the provided concept in fetchItems.
	 *
	 * Each item is of type sevice.ResultSetPart and contains the result set rows where
	 * var is of a certain value
	 *
	 * NOTE: AttrConcept could have an element of type ElementSubQuery, which we can treat in specially for optimization
	 * 
	 * Note: The service is not responsible for ordering by var (in order to have the result set rows pre-grouped)
	 *
	 * isInnerJoin controls whether the attributes are optional or mandatory:
	 * If isInnerJoin is false, attributes are considered optional, and e.g. fetchCount will solely rely on the provided concept
	 * If it is true, an inner join between the attributes and the concept will be made, and e.g. fetchCount will return the number of items in their intersection
	 *
	 * ConceptTypes: FilterConcept: No triple-patterns - just filters on the concept.getVar()
	 *               QueryConcept: Concept with a ElementSubQuery as its element
	 *               SubjectConcept: Concept which is isomorph to the concept ({?s ?p ?o}, ?s)
	 * @param isLeftJoin true indidcates that the attributes are optional
	 */
	ns.ListServiceSparqlQuery = Class.create(ns.ListService, {
	    initialize: function(sparqlService, attrQuery, attrVar, isLeftJoin) {
	        if(attrQuery.getLimit() || attrQuery.getOffset()) {
	            console.log('Limit and offset in attribute queries not yet supported');
	            throw 'Limit and offset in attribute queries not yet supported';
	        }
	        
	        this.sparqlService = sparqlService;
	        this.attrQuery = attrQuery;
	        this.attrVar = attrVar;
	        this.isLeftJoin = isLeftJoin == null ? true : isLeftJoin;
	    },
	    
	    fetchItems: function(filterConcept, limit, offset) {
	        var attrVar = this.attrVar;
	        var query = facete.ConceptUtils.createAttrQuery(this.attrQuery, attrVar, this.isLeftJoin, filterConcept, limit, offset);
	        
	        var qe = this.sparqlService.createQueryExecution(query);
	        
	        var result = qe.execSelect().pipe(function(rs) {
	            var map = ns.ResultSetUtils.partition(rs, attrVar);
	            var entries = map.entries();
	            
	            var r = _(entries).values();
	            return r;
	            // partition the result set according to the attrConcept.getVar();
	        });

	        return result;
	    },
	    
	    fetchCount: function(concept, itemLimit, rowLimit) {

	        var countConcept;
            if(this.isLeftJoin) {
                var query = facete.ConceptUtils.createAttrQuery(this.attrQuery, this.attrVar, this.isLeftJoin, filterConcept, itemLimit, null);

                countConcept = new facete.Concept(query.getQueryPattern(), this.attrVar);
            } else {
                countConcept = concept;
            }
            
            var result = service.ServiceUtils.fetchCountConcept(this.sparqlService, countConcept, itemLimit, rowLimit);
	        return result;
	    }
	});
	
/*	 
	/ **
	 * FORGET THIS - The lookup service abstraction ListServiceConceptKeyLookup does this already
	 * Takes a concept, resolves it against a sparqlService, and creates a filter-concept
	 * which is passed to the underlying service
	 *
	 * /
	ns.ListServiceSparqlExtensional = Class.create(ns.ListService, {
	    initialize: function(listService, sparqlService) {
	        this.listService = listService;
	        this.sparqlService = sparqlService;
	    },
	    
	    
	});
	
	/ **
	 *
	 *
	 * /
	ns.ListServicePartition = Class.create(ns.ListService, {
	    initialize: function(listService, partitionSize) {
	        
	    }
	});
*/
	 
/*
	{
	    var sparqlService = new service.SparqlServiceHttp('http://dbpedia.org/sparql', ['http://dbpedia.org']);
	    //sparqlService = new service.SparqlServiceVirtFix(sparqlService);
	    //sparqlService = new service.SparqlServicePageExpand(sparqlService, 100);
	    //var attrConcept = new facete.Concept(sparql.ElementString.create('?s <http://www.w3.org/2000/01/rdf-schema#> ?o'), rdf.NodeFactory.createVar('s'));
	    var attrQuery = new sparql.Query();
	    var s = rdf.NodeFactory.createVar('s');
	    var p = rdf.NodeFactory.createVar('p');
	    var o = rdf.NodeFactory.createVar('o');
	    var c = rdf.NodeFactory.createVar('c');
	    
	    attrQuery.getProject().add(s);
	    attrQuery.getProject().add(c, new sparql.E_Count());	    
	    attrQuery.setQueryPattern(new sparql.ElementTriplesBlock([new rdf.Triple(s, vocab.rdfs.label, o)]));
	    
	    var filterConcept = facete.ConceptUtils.createTypeConcept('http://dbpedia.org/ontology/Castle'); 
	    var ls = new service.ListServiceSparqlQuery(sparqlService, attrQuery, s, false);
	    ls = new service.ListServicePageExpand(ls, 100);
		
		ls.fetchItems(filterConcept, 10, 20).pipe(function(items) {
		   console.log('Items: ', items); 
		});	
		
		ls.fetchCount(filterConcept).pipe(function(countInfo) {
		    alert(JSON.stringify(countInfo)); 
		});
	}
*/
	//throw 'done';
	
	
	ns.QueryExecutionDelegate = Class.create(ns.QueryExecution, {
	    initialize: function(sparqlService, query) {
	        this.sparqlService = sparqlService;
	        this.query = query;
	        
	        this.timeout = null;
	    },
	    
	    setTimeout: function(timeout) {
	        this.timeout = timeout;
	    },
	    
	    createQueryExecution: function(q) {
	        var result = this.sparqlService.createQueryExecution(q || this.query);
	        result.setTimeout(this.timeout);
	        return result;
	    },
	    
	    /*
	    execConstruct: function() {
	        var result = this.sparqlService.execConstruct(this.query);
	        return result;
	    },
	    */

	    execSelect: function() {
            var result = this.createQueryExecution().execSelect(this.query);
            return result;
        },

        /*
        execDescribe: function() {
            var result = this.sparqlService.execDescribe(this.query);
            return result;
        },
        */
        
        execAsk: function() {
            var result = this.createQueryExecution().execAsk(this.query);
            return result;
        }
	});
	
    ns.QueryExecutionPageExpand = Class.create(ns.QueryExecutionDelegate, {
        initialize: function($super, sparqlService, query, pageSize) {
            $super(sparqlService, query);
            this.pageSize = pageSize;
        },

        /**
         * Send the query, and only return the subset result set in the given sub range.
         *
         */
        execSelect: function() {
            var q = this.query.clone();            
            var x = ns.PageExpandUtils.computeRange(q.getLimit(), q.getOffset(), this.pageSize);
            
            q.setLimit(x.limit);
            q.setOffset(x.offset);
                        
            var qe = this.createQueryExecution(q);
            var p = qe.execSelect();
            var result = p.pipe(function(rs) {
                var bindings = rs.getIterator().getArray();
                
                var end = x.subLimit ? x.subOffset + x.subLimit : bindings.length;
                var subBindings = bindings.slice(x.subOffset, end); 
                
                var varNames = rs.getVarNames();
                var it = new util.IteratorArray(subBindings);
                var r = new service.ResultSetArrayIteratorBinding(it, varNames);
                
                return r;
            });
            
            return result;
        }
    });
    

    /**
     * Sparql Service wrapper that expands limit/offset in queries
     * to larger boundaries. Intended to be used in conjunction with a cache.
     *
     */
    ns.SparqlServicePageExpand = Class.create(ns.SparqlService, {
        initialize: function(sparqlService, pageSize) {
            this.sparqlService = sparqlService;
            this.pageSize = pageSize;
        },
    
        getServiceId: function() {
            return this.sparqlService.getServiceId();
        },
        
        getStateHash: function() {
            return this.sparqlService.getStateHash();
        },

        hashCode: function() {
            return 'page-expand:' + this.sparqlService.hashCode();
        },

        createQueryExecution: function(query) {
            var result = new ns.QueryExecutionPageExpand(this.sparqlService, query, this.pageSize);
            return result;
        }
    });




/*
    var sparqlService = new service.SparqlServiceHttp('http://dbpedia.org/sparql', ['http://dbpedia.org']);
    sparqlService = new service.SparqlServiceVirtFix(sparqlService);
    sparqlService = new service.SparqlServicePageExpand(sparqlService, 100);
    
    var c = facete.ConceptUtils.createSubjectConcept();
    var q = facete.ConceptUtils.createQueryList(c, 130, null);
    var qe = sparqlService.createQueryExecution(q);
    qe.execSelect().done(function(rs) {
       while(rs.hasNext()) {
           console.log(rs.next());
       } 
    });
*/


	
	facete.ConceptUtils.fetchItems = function(sparqlService, concept, limit, offset) {
	    var query = this.createQueryList(concept, limit, offset);
	    var qe = sparqlService.createQueryExecution(query);
	    
	    var result = qe.execSelect().pipe(function(rs) {
	        var r = service.ServiceUtils.resultSetToList(rs, concept.getVar());
	        return r;
	    });

	    return result;
	};


	
	ns.ListServiceConcept = Class.create(ns.ListService, {
	    initialize: function(sparqlService) {
	        this.sparqlService = sparqlService;
	    },
	    
	    fetchItems: function(concept, limit, offset) {
	        var result = facete.ConceptUtils.fetchItems(this.sparqlService, concept, limit, offset);
	        return result;
	    },
	    
	    fetchCount: function(concept, itemLimit, rowLimit) {
	        var result = ns.ServiceUtils.fetchCountConcept(this.sparqlService, concept, itemLimit, rowLimit);
	        return result;
	    }
	});
	
    ns.ListServiceConceptKeyLookup = Class.create(ns.ListService, {
        // initialize: function(conceptLookupService, keyLookupService) {
        initialize: function(keyListService, keyLookupService, isLeftJoin) {
            this.keyListService = keyListService;
            this.keyLookupService = keyLookupService;
            this.isLeftJoin = isLeftJoin == null ? true : isLeftJoin;
        },
        
        fetchItems: function(concept, limit, offset) {
            var deferred = jQuery.Deferred();
            
            var self = this; 
            
            var promise = this.keyListService.fetchItems(concept, limit, offset);            
            promise.pipe(function(keys) {
                
                self.keyLookupService.lookup(keys).pipe(function(map) {

                    //deferred.resolve(map);

                    var entries = map.entries();
                    var r = _(entries).values();
                    deferred.resolve(r);

                }).fail(function() {
                    deferred.reject();
                });
            }).fail(function() {
                deferred.reject();
            });
            
            return deferred.promise();
        },
        
        fetchCount: function(concept, itemLimit, rowLimit) {
            var result;
            if(this.isLeftJoin) {
                result = this.keyListService.fetchCount(concept, itemLimit, rowLimit);
            } else {
                var self = this;
                var deferred = jQuery.Deferred();

                var p = this.keyListService.fetchItems(concept, itemLimit);
                p.pipe(function(items) {
                    var p2 = self.keyLookupService.lookup(items);
                    p2.pipe(function(map) {
                        var keyList = map.keyList();
                        var count = keyList.length;
                        var r = {
                            count: count,
                            hasMoreItems: itemLimit == null ? false : null // absence of a value indicates 'unknown'
                        };
                        deferred.resolve(r);
                    }).fail(function() {
                        deferred.reject();
                    });
                }).fail(function() {
                    deferred.reject();
                });
                
                result = deferred.promise();
            }
            
            return result;
        }
    });
	
})();

