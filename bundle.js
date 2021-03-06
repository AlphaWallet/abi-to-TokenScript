(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
document.addEventListener("DOMContentLoaded", () => {

    const Types = {
        FUNCTION: "function",
        TUPLE: "tuple",
        EVENT: "event"
    };

    const ERC = {
        ERC20: "erc20",
        ERC721: "erc721"
    };

    let network = "1";

    let contractsFromEvents = [];
    let mainContractAddress = "";

    const templates = require("./templates");

    document.getElementById("create").addEventListener("click", () => {
        let contractName = document.getElementById("contractName").value;
        let contractAddress = document.getElementById("contractAddress").value;
        mainContractAddress = contractAddress;
        let abi = getABI(document.getElementById("contractABI").value);
        let erc20Checked = document.getElementById("erc20").checked;
        network = document.getElementById("network").value;
        if(erc20Checked) {
            start(ERC.ERC20, abi, contractAddress, contractName);
        } else {
            start(ERC.ERC721, abi, contractAddress, contractName);
        }
    });

    function getABI(abi) {
        try {
            return JSON.parse(abi);
        } catch {
            //abi left empty, proceed but just give the default template
            return undefined;
        }
    }

    function start(erc, abi, contractAddress, contractName, network) {
        let domParser = new DOMParser();
        let xmlFile;
        switch(erc) {
            case ERC.ERC20:
                xmlFile = domParser.parseFromString(templates.erc20XML, "application/xml");
                break;
            case ERC.ERC721:
                xmlFile = domParser.parseFromString(templates.erc721XML, "application/xml");
                break;
        }
        xmlFile = setContractDetails(xmlFile, contractName, contractAddress);
        if(abi === undefined) {
            setValuesWithoutABI(erc, xmlFile, contractAddress, contractName);
        } else {
            setValuesFromABI(erc, abi, xmlFile, contractAddress, contractName);
        }
    }

    function setValuesFromABI(erc, abi, xmlFile, contractAddress, contractName) {
        let attributesToAdd = [];
        let eventsToAdd = [];
        for(let func of abi) {
            switch(func.type) {
                case Types.FUNCTION:
                    let attribute = parseFunctionToAttribute(func, contractName);
                    if(attribute !== "") attributesToAdd.push(attribute);
                    break;
                case Types.EVENT:
                    let event = getEvent(func.name, contractName, contractAddress, func);
                    eventsToAdd.push(event.event);
                    addEventContractObj(event.contractObject);
                    break;
                case Types.TUPLE:
                    break;
            }
        }
        let updatedXML = appendToTS(attributesToAdd, eventsToAdd, xmlFile);
        //TODO fix xhtml problem properly rather than replace
        let xmlAsString = new XMLSerializer().serializeToString(updatedXML).replace(/xhtml:/g,"").replace(/amp;/g, "");
        downloadFilesAsZip(erc, contractName, vkbeautify.xml(xmlAsString));
    }

    function addEventContractObj(contractObj) {
        //if event is sourced from the TS contract, there is no need to add it again
        if(contractObj.address === mainContractAddress) return;
        for(let contract of contractsFromEvents) {
            if(contract.address === contractObj.address) {
                //contract already included
                return;
            }
        }
        contractsFromEvents.push(contractObj);
    }

    function setValuesWithoutABI(erc, xmlFile, contractAddress, contractName) {
        //TODO fix xhtml problem properly rather than replace
        let xmlAsString = new XMLSerializer().serializeToString(xmlFile).replace(/xhtml:/g,"").replace(/amp;/g, "");
        downloadFilesAsZip(erc, contractName, vkbeautify.xml(xmlAsString));
    }

    function downloadFilesAsZip(erc, contractName, xmlAsString) {
        let zip = new JSZip();
        let folder = zip.folder(contractName);
        xmlAsString = appendMissingEntities(xmlAsString);
        folder.file(contractName + "-TokenScript.xml", xmlAsString, null);
        //CSS is the same for 721 and 20 but the user needs the paths to match in the entities
        let cssPromise = $.get("https://raw.githubusercontent.com/AlphaWallet/abi-to-TokenScript/gh-pages/samples/erc20/shared.css");
        folder.file("shared.css", cssPromise, null);
        let makeFilePromise = $.get("https://raw.githubusercontent.com/AlphaWallet/abi-to-TokenScript/gh-pages/samples/Makefile");
        folder.file("Makefile", makeFilePromise, null);
        let readmePromise = $.get("https://raw.githubusercontent.com/AlphaWallet/abi-to-TokenScript/gh-pages/samples/README.md");
        folder.file("README.md", readmePromise, null);
        switch(erc) {
            case ERC.ERC20:
                let aboutPromise20 = $.get("https://raw.githubusercontent.com/AlphaWallet/abi-to-TokenScript/gh-pages/samples/erc20/about.en.js");
                folder.file("about.en.js", aboutPromise20, null);
                let approvePromise20 = $.get("https://raw.githubusercontent.com/AlphaWallet/abi-to-TokenScript/gh-pages/samples/erc20/approve.en.js");
                folder.file("approve.en.js", approvePromise20, null);
                break;
            case ERC.ERC721:
                let aboutPromise721 = $.get("https://raw.githubusercontent.com/AlphaWallet/abi-to-TokenScript/gh-pages/samples/erc721/about.en.js");
                folder.file("about.en.js", aboutPromise721, null);
                let approvePromise721 = $.get("https://raw.githubusercontent.com/AlphaWallet/abi-to-TokenScript/gh-pages/samples/erc721/approve.en.js");
                folder.file("approve.en.js", approvePromise721, null);
                break;
        }
        zip.generateAsync({ type: "blob" }).then((content) => {
            saveAs(content, contractName + ".zip");
        });
    }

    function appendMissingEntities(xmlString) {
        let headerWithEntities = templates.header + templates.entities;
        let xmlWithoutHeadersOrEntities = xmlString.replace("<!DOCTYPE token>", "").replace(templates.header, "");
        return headerWithEntities + xmlWithoutHeadersOrEntities;
    }

    //TODO pass by ref rather than value
    function appendToTS(attributes, events, xmlFile) {
        for(let attribute of attributes) {
            xmlFile.getElementsByTagName("ts:token")[0].appendChild(attribute);
        }
        for(let event of events) {
            xmlFile.getElementsByTagName("ts:token")[0].insertBefore(event, xmlFile.getElementsByTagName("ts:label")[0]);
        }
        for(let contract of contractsFromEvents) {
            xmlFile.getElementsByTagName("ts:token")[0].insertBefore(contract.element, xmlFile.getElementsByTagName("ts:contract")[0]);
        }
        return xmlFile;
    }

    function setContractDetails(xmlFile, contractName, contractAddress) {
        //set network
        xmlFile.getElementsByTagName("ts:contract")[0].getElementsByTagName("ts:address")[0].setAttribute("network", network);

        xmlFile.getElementsByTagName("ts:label")[0].getElementsByTagName("ts:string")[0].innerHTML = contractName;
        xmlFile.getElementsByTagName("ts:contract")[0].getElementsByTagName("ts:address")[0].innerHTML = contractAddress;
        xmlFile.getElementsByTagName("ts:origins")[0].getElementsByTagName("ts:ethereum")[0].setAttribute("contract", contractName);
        xmlFile.getElementsByTagName("ts:contract")[0].attributes.name.value = contractName;
        xmlFile.getElementsByTagName("ts:contract")[0].children[0].value = contractAddress;
        xmlFile.getElementsByTagName("ts:cards")[0].getElementsByTagName("ts:card")[1]
            .getElementsByTagName("ts:transaction")[0].
        getElementsByTagName("ethereum:transaction")[0].setAttribute("contract", contractName);

        //set stripped entity tags
        xmlFile.getElementsByTagName("ts:token")[0].getElementsByTagName("ts:cards")[0].getElementsByTagName("ts:card")[0]
            .getElementsByTagName("ts:view")[0].getElementsByTagName("xhtml:style")[0].innerHTML = "&style;";
        xmlFile.getElementsByTagName("ts:token")[0].getElementsByTagName("ts:cards")[0]
            .getElementsByTagName("ts:card")[0].getElementsByTagName("ts:view")[0]
            .getElementsByTagName("xhtml:script")[0].innerHTML = "&about.en;";

        xmlFile.getElementsByTagName("ts:token")[0].getElementsByTagName("ts:cards")[0].getElementsByTagName("ts:card")[1]
            .getElementsByTagName("ts:view")[0].getElementsByTagName("xhtml:style")[0].innerHTML = "&style;";
        xmlFile.getElementsByTagName("ts:token")[0].getElementsByTagName("ts:cards")[0]
            .getElementsByTagName("ts:card")[1].getElementsByTagName("ts:view")[0]
            .getElementsByTagName("xhtml:script")[0].innerHTML = "&approve.en;";

        return xmlFile;
    }

    function getEventParams(eventAbi) {
        let eventParams = [];
        for(let eventInput of eventAbi.inputs) {
            let elementNode = document.createElement("element");
            elementNode.setAttribute("name", eventInput.name);
            elementNode.setAttribute("ethereum:type", eventInput.type);
            elementNode.setAttribute("ethereum:indexed", eventInput.indexed);
            eventParams.push(elementNode);
        }
        return eventParams;
    }

    function parseFunctionToAttribute(func, contractName) {
        //can only handle simple gets without inputs
        if((func.stateMutability === "view" || func.stateMutability === "pure") && func.inputs.length === 0) {
            return getAttribute(func, contractName);
        } else {
            return "";
        }
    }

    function getAttribute(func, contractName) {
        let data = getData(func);
        let attributeTypeNode = document.createElement("ts:attribute");
        attributeTypeNode.setAttribute("name", func.name);
        let type = document.createElement("ts:type");
        let syntaxElement = document.createElement("ts:syntax");
        let syntax = getSyntax(func.outputs);
        if(syntax !== "") {
            syntaxElement.innerText = syntax;
        }
        type.appendChild(syntaxElement);
        attributeTypeNode.appendChild(type);
        let nameNode = document.createElement("ts:label");
        let stringNodeName = document.createElement("ts:string");
        stringNodeName.setAttribute("xml:lang", "en");
        stringNodeName.innerText = func.name;
        nameNode.appendChild(stringNodeName);
        attributeTypeNode.appendChild(nameNode);
        let originNode = document.createElement("ts:origins");
        let ethereumNode = document.createElement("ethereum:call");
        ethereumNode.setAttribute("function", func.name);
        ethereumNode.setAttribute("contract", contractName);
        let AS = getAS(func.outputs);
        if(AS !== "") {
            ethereumNode.setAttribute("as", AS);
        } else {
            //do not include as
        }
        ethereumNode.innerText = data;
        originNode.appendChild(ethereumNode);
        attributeTypeNode.appendChild(originNode);
        return attributeTypeNode;
    }

    function getEvent(eventName, contractName, contractAddress, eventABI) {
        let eventObject = {};
        let eventParams = getEventParams(eventABI);
        let moduleNode = document.createElement("asnx:module");
        moduleNode.setAttribute("name", contractName + "-event-" + eventName);
        let namedTypeNode = document.createElementNS(null, "namedType");
        namedTypeNode.setAttribute("name", eventName);
        let typeNode = document.createElement("type");
        let sequenceNode = document.createElement("sequence");
        eventParams.map((eventParam) => {
            sequenceNode.appendChild(eventParam);
        });
        typeNode.appendChild(sequenceNode);
        namedTypeNode.appendChild(typeNode);
        moduleNode.appendChild(namedTypeNode);
        eventObject.event = moduleNode;
        eventObject.contractObject = getEventContractObject(contractName, contractAddress);
        return eventObject;
    }

    function getEventContractObject(contractName, contractAddress) {
        let eventContractObject = {};
        let contractObjectFromEvent = document.createElement("ts:contract");
        //Can't set the contract name to be the same as the previously declared
        contractObjectFromEvent.setAttribute("name", "contractWithEvent" + contractName);
        let addressNode = document.createElement("ts:address");
        addressNode.setAttribute("network", network);
        addressNode.innerText = contractAddress;
        contractObjectFromEvent.appendChild(addressNode);
        eventContractObject.element = contractObjectFromEvent;
        eventContractObject.address = contractAddress;
        return eventContractObject;
    }

    function getData(func) {
        let dataElement = document.createElement("ts:data");
        if(func.inputs.length !== 0) {
            for(let input of func.inputs) {
                let paramNode = document.createTextNode(`ts:${input.type}`);
                dataElement.appendChild(paramNode);
            }
            return dataElement;
        } else {
            return "";
        }
    }

    //TODO make into a comprehensive switch statement with enum
    function getAS(outputs) {
        if(outputs === []) {
            return "";
        } else {
            let ethType = outputs[0].type;
            if(ethType.includes("uint")) {
                return "uint";
            } else if(ethType.includes("byte")) {
                return "bytes";
            } else if(ethType.includes("string")) {
                return "utf8";
            } else if(ethType.includes("address")) {
                return "address";
            } else {
                return "";
            }
        }
    }

    //This requires guess work...
    function getSyntax(outputs) {
        if(outputs === []) {
            return "";
        } else if(outputs[0].type.includes("uint") || outputs[0].type.includes("int")) {
            return "1.3.6.1.4.1.1466.115.121.1.36";
        } else if(outputs[0].type.includes("string")) {
            return "1.3.6.1.4.1.1466.115.121.1.26";
        } else if(outputs[0].type.includes("byte")) {
            return "1.3.6.1.4.1.1466.115.121.1.6";
        } else {
            return "1.3.6.1.4.1.1466.115.121.1.15";
        }
    }

});

},{"./templates":2}],2:[function(require,module,exports){
module.exports = {

    header: "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n",

    entities: "<!DOCTYPE token  [\n" +
        "        <!ENTITY style SYSTEM \"shared.css\">\n" +
        "        <!ENTITY about.en SYSTEM \"about.en.js\">\n" +
        "        <!ENTITY approve.en SYSTEM \"approve.en.js\">\n" +
        "        ]>\n",

    erc20XML: "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n" +
        "<!DOCTYPE token  [\n" +
        "        <!ENTITY style SYSTEM \"shared.css\">\n" +
        "        <!ENTITY about.en SYSTEM \"about.en.js\">\n" +
        "        <!ENTITY approve.en SYSTEM \"approve.en.js\">\n" +
        "        ]>\n" +
        "<ts:token xmlns:ts=\"http://tokenscript.org/2020/06/tokenscript\"\n" +
        "          xmlns:xhtml=\"http://www.w3.org/1999/xhtml\"\n" +
        "          xmlns:xml=\"http://www.w3.org/XML/1998/namespace\"\n" +
        "          xsi:schemaLocation=\"http://tokenscript.org/2020/06/tokenscript http://tokenscript.org/2020/06/tokenscript.xsd\"\n" +
        "          xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\"\n" +
        "          xmlns:asnx=\"urn:ietf:params:xml:ns:asnx\"\n" +
        "          xmlns:ethereum=\"urn:ethereum:constantinople\"\n" +
        "          custodian=\"false\"\n" +
        ">\n" +
        "    <ts:label>\n" +
        "        <ts:string xml:lang=\"en\"></ts:string>\n" +
        "    </ts:label>\n" +
        "    <ts:contract interface=\"erc20\" name=\"\">\n" +
        "        <ts:address network=\"1\"></ts:address>     <!--mainnet-->\n" +
        "    </ts:contract>\n" +
        "\n" +
        "    <ts:origins>\n" +
        "        <!-- Define the contract which holds the token that the user will use -->\n" +
        "        <ts:ethereum contract=\"\"/> <!-- as above ts:contract name -->\n" +
        "    </ts:origins>\n" +
        "\n" +
        "    <ts:cards>\n" +
        "        <ts:card type=\"action\">\n" +
        "            <ts:label>\n" +
        "                <ts:string xml:lang=\"en\">About</ts:string>\n" +
        "            </ts:label>\n" +
        "            <ts:view xmlns=\"http://www.w3.org/1999/xhtml\" xml:lang=\"en\">\n" +
        "                <xhtml:style type=\"text/css\">&style;</xhtml:style>\n" +
        "                <xhtml:script type=\"text/javascript\">&about.en;</xhtml:script>\n" +
        "            </ts:view>\n" +
        "        </ts:card>\n" +
        "\n" +
        "        <ts:card type=\"action\">\n" +
        "            <ts:label>\n" +
        "                <ts:string xml:lang=\"en\">Approve</ts:string>\n" +
        "            </ts:label>\n" +
        "            <ts:attribute name=\"approvalAddress\">\n" +
        "                <ts:type>\n" +
        "                    <ts:syntax>1.3.6.1.4.1.1466.115.121.1.36</ts:syntax>\n" +
        "                </ts:type>\n" +
        "                <ts:label>\n" +
        "                    <ts:string xml:lang=\"en\">Approval Address</ts:string>\n" +
        "                </ts:label>\n" +
        "                <ts:origins>\n" +
        "                    <ts:user-entry as=\"address\"/>\n" +
        "                </ts:origins>\n" +
        "            </ts:attribute>\n" +
        "            <ts:transaction>\n" +
        "                <ethereum:transaction function=\"approve\" contract=\"\" as=\"uint\">\n" +
        "                    <ts:data>\n" +
        "                        <ts:address ref=\"approvalAddress\"/>\n" +
        "                        <ts:uint256>115792089237316195423570985008687907853269984665640564039457584007913129639935</ts:uint256>\n" +
        "                    </ts:data>\n" +
        "                </ethereum:transaction>\n" +
        "            </ts:transaction>\n" +
        "            <ts:view xmlns=\"http://www.w3.org/1999/xhtml\" xml:lang=\"en\">\n" +
        "                <xhtml:style type=\"text/css\">&style;</xhtml:style>\n" +
        "                <xhtml:script type=\"text/javascript\">&approve.en;</xhtml:script>\n" +
        "            </ts:view>\n" +
        "        </ts:card>\n" +
        "    </ts:cards>\n" +
        "</ts:token>\n",

    erc721XML: "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n" +
        "<!DOCTYPE token  [\n" +
        "        <!ENTITY style SYSTEM \"shared.css\">\n" +
        "        <!ENTITY about.en SYSTEM \"about.en.js\">\n" +
        "        <!ENTITY approve.en SYSTEM \"approve.en.js\">\n" +
        "        ]>\n" +
        "<ts:token xmlns:ts=\"http://tokenscript.org/2020/06/tokenscript\"\n" +
        "          xmlns:xhtml=\"http://www.w3.org/1999/xhtml\"\n" +
        "          xmlns:xml=\"http://www.w3.org/XML/1998/namespace\"\n" +
        "          xsi:schemaLocation=\"http://tokenscript.org/2020/06/tokenscript http://tokenscript.org/2020/06/tokenscript.xsd\"\n" +
        "          xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\"\n" +
        "          xmlns:asnx=\"urn:ietf:params:xml:ns:asnx\"\n" +
        "          xmlns:ethereum=\"urn:ethereum:constantinople\"\n" +
        "          custodian=\"false\"\n" +
        ">\n" +
        "    <ts:label>\n" +
        "        <ts:string xml:lang=\"en\"></ts:string>\n" +
        "    </ts:label>\n" +
        "    <ts:contract interface=\"erc721\" name=\"\">\n" +
        "        <ts:address network=\"1\"></ts:address>     <!--mainnet-->\n" +
        "    </ts:contract>\n" +
        "\n" +
        "    <ts:origins>\n" +
        "        <!-- Define the contract which holds the token that the user will use -->\n" +
        "        <ts:ethereum contract=\"\"/> <!-- as above ts:contract name -->\n" +
        "    </ts:origins>\n" +
        "\n" +
        "    <ts:cards>\n" +
        "        <ts:card type=\"action\">\n" +
        "            <ts:label>\n" +
        "                <ts:string xml:lang=\"en\">About</ts:string>\n" +
        "            </ts:label>\n" +
        "            <ts:view xmlns=\"http://www.w3.org/1999/xhtml\" xml:lang=\"en\">\n" +
        "                <xhtml:style type=\"text/css\">&style;</xhtml:style>\n" +
        "                <xhtml:script type=\"text/javascript\">&about.en;</xhtml:script>\n" +
        "            </ts:view>\n" +
        "        </ts:card>\n" +
        "\n" +
        "        <ts:card type=\"action\">\n" +
        "            <ts:label>\n" +
        "                <ts:string xml:lang=\"en\">Approve</ts:string>\n" +
        "            </ts:label>\n" +
        "            <ts:attribute name=\"approvalAddress\">\n" +
        "                <ts:type>\n" +
        "                    <ts:syntax>1.3.6.1.4.1.1466.115.121.1.36</ts:syntax>\n" +
        "                </ts:type>\n" +
        "                <ts:label>\n" +
        "                    <ts:string xml:lang=\"en\">Approval Address</ts:string>\n" +
        "                </ts:label>\n" +
        "                <ts:origins>\n" +
        "                    <ts:user-entry as=\"address\"/>\n" +
        "                </ts:origins>\n" +
        "            </ts:attribute>\n" +
        "            <ts:transaction>\n" +
        "                <ethereum:transaction function=\"approve\" contract=\"\" as=\"uint\">\n" +
        "                    <ts:data>\n" +
        "                        <ts:address ref=\"approvalAddress\"/>\n" +
        "                        <ts:uint256 ref=\"tokenId\"/>\n" +
        "                    </ts:data>\n" +
        "                </ethereum:transaction>\n" +
        "            </ts:transaction>\n" +
        "            <ts:view xmlns=\"http://www.w3.org/1999/xhtml\" xml:lang=\"en\">\n" +
        "                <xhtml:style type=\"text/css\">&style;</xhtml:style>\n" +
        "                <xhtml:script type=\"text/javascript\">&approve.en;</xhtml:script>\n" +
        "            </ts:view>\n" +
        "        </ts:card>\n" +
        "    </ts:cards>\n" +
        "</ts:token>\n",

    exampleABI: [
        {
            "inputs": [
                {
                    "internalType": "uint8",
                    "name": "_numProposals",
                    "type": "uint8"
                }
            ],
            "stateMutability": "nonpayable",
            "type": "constructor"
        },
        {
            "anonymous": false,
            "inputs": [
                {
                    "indexed": true,
                    "internalType": "address",
                    "name": "h1",
                    "type": "address"
                },
                {
                    "indexed": true,
                    "internalType": "uint256",
                    "name": "no",
                    "type": "uint256"
                }
            ],
            "name": "test",
            "type": "event"
        },
        {
            "inputs": [
                {
                    "internalType": "address",
                    "name": "to",
                    "type": "address"
                }
            ],
            "name": "delegate",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
        },
        {
            "inputs": [
                {
                    "internalType": "address",
                    "name": "toVoter",
                    "type": "address"
                }
            ],
            "name": "giveRightToVote",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
        },
        {
            "inputs": [
                {
                    "internalType": "uint8",
                    "name": "toProposal",
                    "type": "uint8"
                }
            ],
            "name": "vote",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
        },
        {
            "inputs": [],
            "name": "winningProposal",
            "outputs": [
                {
                    "internalType": "uint8",
                    "name": "_winningProposal",
                    "type": "uint8"
                }
            ],
            "stateMutability": "view",
            "type": "function"
        }
    ]
};

},{}]},{},[1]);
