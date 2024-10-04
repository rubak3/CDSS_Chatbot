// Scene navigation
const scene1 = document.getElementById('scene1');
const scene2 = document.getElementById('scene2');

// Smart contract setub
const regContractAddress = "0x173dC51680152286317DBA0A74C1ddF6A0077929";
let regContractABI;
const recordsContractAddress = "0x7145583bBc28c63b495AeA3A3B618537840BadA0";
let recordsContractABI;
let patientAddress;

// Input and button elements
const connectWalletButton = document.getElementById('connectWalletButton');
const startChatButton = document.getElementById('startChatButton');
const chatInput = document.getElementById('chatInput');
const chatOutput = document.getElementById('chat-output');
const sendMessageButton = document.getElementById('sendMessage');
const walletMessage = document.getElementById('walletMessage');
const walletAddress = document.getElementById('walletAddress');
const userMessage = document.getElementById('userMessage');
const pAddress = document.getElementById('patientAddress');
const closeButton = document.getElementById('closeButton');
const fetchingMessage = document.getElementById('fetchingMessage');
let userMessageElement;
let llmMessageElement;

// Ethers.js setup
const provider = new ethers.providers.Web3Provider(window.ethereum);
let etherscanApiUrl;
let signer;
let regContract;
let recordsContract;
let regSCIface;
let recordsSCIface;

// OpenAI setup
const apiKey = 'Your-API-Key';
let assistantId;
let vectorStoreId;
let threadId;
let runId;
let callId;
let fileIds = [];
let files = [];
let i = 0;

// Function to handle wallet connection
async function connectWallet() {
  etherscanApiUrl = `https://api-sepolia.etherscan.io/api?module=contract&action=getabi&address=`;

  // Fetch the reg SC ABI from Etherscan
  const regAbiResponse = await axios.get(`${etherscanApiUrl}${regContractAddress}`);
  regContractABI = JSON.parse(regAbiResponse.data.result);
  regSCIface = new ethers.utils.Interface(regContractABI);

  // Fetch the records SC ABI from Etherscan
  const recordsAbiResponse = await axios.get(`${etherscanApiUrl}${recordsContractAddress}`);
  recordsContractABI = JSON.parse(recordsAbiResponse.data.result); 
  recordsSCIface = new ethers.utils.Interface(recordsContractABI);

  try {
    // Request account access
    await provider.send('eth_requestAccounts', []);
    signer = provider.getSigner();
    const accounts = await provider.listAccounts();
    const clinicianAddress = accounts[0]; // Get the first account
    console.log('Connected wallet address:', clinicianAddress);
    regContract = new ethers.Contract(regContractAddress, regContractABI, signer);
    recordsContract = new ethers.Contract(recordsContractAddress, recordsContractABI, signer);

    if(await authenticateClinician()) {
      // Call the functions to create the assistant and the vector store
      await createAssistant();
      await createVectorStore("Patient Medical Records");
      // Show the wallet address and patient address input after successful connection
      walletMessage.textContent = "You are authenticated successfully!";
      walletMessage.style.color = "#28a745";
      walletAddress.textContent = `Address: ${clinicianAddress}`;
      document.getElementById('addressSection').style.display = 'block';  // Reveal the patient address input section
      connectWalletButton.disabled = true;
    } else {
      walletMessage.textContent = "You are not registered! You cannot access the system";
      walletMessage.style.color = '#db1515';
    }

  } catch (error) {
    console.error('Error connecting to MetaMask:', error);
    walletMessage.textContent = "Failed to connect to MetaMask. Please try again.";
    walletMessage.style.color = '#db1515';
  }
}

// Event listener for wallet connection
connectWalletButton.addEventListener("click", connectWallet);

// Function to authenticate clinician address
async function authenticateClinician() {
  const auth = await regContract.isClinicianRegistered();
  return auth;
}

// Function to authenticate patient address (call smart contract function)
async function authenticatePatient() {
  try {
    patientAddress = pAddress.value.trim();
    const authenticated = await regContract.isPatientRegistered(patientAddress);
    if (authenticated) {
      userMessage.textContent = 'Patient authenticated successfully!';
      userMessage.style.color = '#28a745';
      fetchingMessage.style.color = '#333';
      fetchingMessage.textContent = 'Fetching patient data...';
    } else {
      startChatButton.disabled = true;
      userMessage.textContent = 'Patient is not registered! Please enter a valid address';
      userMessage.style.color = '#db1515';
    }
    return authenticated;
  } catch (error) {
    //console.error(error);
    startChatButton.disabled = true;
    userMessage.textContent = 'Patient is not registered! Please enter a valid address';
    userMessage.style.color = '#db1515';
  }
}

// Event listener for patient address input field
pAddress.addEventListener('keydown', async function(event) {
  if (event.key === 'Enter') {
    if (await authenticatePatient()) {
      await getRegSCEventLogs(regContractAddress);
      await getRecordsSCEventLogs(recordsContractAddress);
      fetchingMessage.style.color = '#28a745';
      fetchingMessage.textContent = 'You can now start chatting'
      startChatButton.disabled = false;
    }
  }
});

// Handle start chatting button click to move to the chat scene
startChatButton.addEventListener('click', async function() {
  const address = pAddress.value.trim();
  if (address !== "") {
    scene1.classList.remove('active');
    scene2.classList.add('active');
  } else {
    extraMessage.textContent = "Please enter a valid patient address.";
  }
});

// Handle X button to return to the first scene
closeButton.addEventListener('click', async function() {
  startChatButton.disabled = true;
  userMessage.textContent = "";
  walletMessage.textContent = "";
  walletAddress.textContent = "";
  fetchingMessage.textContent = "";
  document.getElementById('addressSection').style.display = 'none';  // Reveal the patient address input section
  i = 0;
  pAddress.value = "";
  scene2.classList.remove('active');
  scene1.classList.add('active');

  await deleteAssistant();
  await deleteVectorStore();
  await deleteMultipleFiles();
  connectWalletButton.disabled = false;
});

// Retrieve and display LLM response
async function getLLMResponse() {
  while(true) {
    const messages = await getMessageResponse();
    const message = messages.data[0];
    const run = await getThreadRun();
    console.log("run: ", run);
    console.log(message);
    
      if (run.status == "requires_action" && run.required_action.type == "submit_tool_outputs") {
        if (run.required_action.submit_tool_outputs.tool_calls[0].function.name == "addPrescription") {
          callId = run.required_action.submit_tool_outputs.tool_calls[0].id;
          console.log("callId: ", callId);
          const arg = JSON.parse(run.required_action.submit_tool_outputs.tool_calls[0].function.arguments);
          const condition = arg.condition;
          const medication = arg.medication;
          const dosage = arg.dosage;
          const output = await addPrescription(condition, medication, dosage);
          await submitToolOutputs(output, run.thread_id, run.id);
        }
      } else if (message && message.role === 'assistant' && message.content.length>0) {
        console.log('Assistant response:', message.content[0].text.value);
        // Regular expression to match citation references
        const citationRegex = /【\d+:\d+†source】/g;
        // Replace all citations with an empty string
        const newMess = message.content[0].text.value.replace(citationRegex, '');
        return newMess.replace('**', '');
      }
  }
}

// Function to toggle the Send button based on input content
function toggleSendButton() {
  // Enable the Send button only if there's text in the input field
  if (chatInput.value.trim() !== "") {
    sendMessageButton.disabled = false;
  } else {
    sendMessageButton.disabled = true;
  }
}

// Initial state of the Send button (disabled if input is empty)
toggleSendButton();

// Add event listener for input changes
chatInput.addEventListener('input', toggleSendButton);

// Send message button handler
sendMessageButton.addEventListener('click', async function() {
    const userMessage = chatInput.value.trim();
    if (userMessage !== "") {
        // Display user's message
        userMessageElement = document.createElement('div');
        userMessageElement.classList.add('message', 'user-message');
        userMessageElement.textContent = userMessage;
        userMessageElement.style.fontSize = "15px";
        chatOutput.appendChild(userMessageElement);
        chatInput.value = "";
        await createMessage(userMessage);

        // Get LLM response and display it
        const llmResponse = await getLLMResponse(userMessage);
        llmMessageElement = document.createElement('div');
        llmMessageElement.classList.add('message', 'llm-message');
        llmMessageElement.textContent = llmResponse;
        llmMessageElement.style.fontSize = "15px";
        chatOutput.appendChild(llmMessageElement);

        // Clear input
        chatInput.value = '';
        chatOutput.scrollTop = chatOutput.scrollHeight; // Auto-scroll to the bottom
    }
});

// Function to retrieve all patient transactions/events from the blockchain
async function getRegSCEventLogs(contractAddress, fromBlock = 0, toBlock = 'latest') {
  const url = `https://api-sepolia.etherscan.io/api?module=logs&action=getLogs&address=${contractAddress}&fromBlock=${fromBlock}&toBlock=${toBlock}`;
  
  let logs = [];
  
  try {
    while (!(Array.isArray(logs) && logs.length > 0)) {
      const response = await axios.get(url);
      console.log('API Response:', response.data);
      logs = response.data.result;
    }

    if (Array.isArray(logs) && logs.length > 0) {
      // Use Promise.all to handle all logs in parallel
      const logPromises = logs.map(async (log, index) => {
        console.log(`Event #${index + 1}:`, log);
        return getEventsLogs(log, regSCIface);
      });

      // Wait for all logs to be processed in parallel
      await Promise.all(logPromises);

    } else {
      console.log('No event logs found.');
    }
  } catch (error) {
    console.error('Error fetching logs:', error);
  }
}

// Function to retrieve all patient transactions/events from the blockchain
async function getRecordsSCEventLogs(contractAddress, fromBlock = 0, toBlock = 'latest') {
  const url = `https://api-sepolia.etherscan.io/api?module=logs&action=getLogs&address=${contractAddress}&fromBlock=${fromBlock}&toBlock=${toBlock}&topic1=0x000000000000000000000000${patientAddress.slice(2)}`;
  
  let logs = [];
  
  try {
    while (!(Array.isArray(logs) && logs.length > 0)) {
      const response = await axios.get(url);
      console.log('API Response:', response.data);
      logs = response.data.result;
    }

    if (Array.isArray(logs) && logs.length > 0) {
      // Use Promise.all to handle all logs in parallel
      const logPromises = logs.map(async (log, index) => {
        console.log(`Event #${index + 1}:`, log);
        return getEventsLogs(log, recordsSCIface);
      });

      // Wait for all logs to be processed in parallel
      await Promise.all(logPromises);

      // Once all files are collected, upload them in parallel
      if (files.length > 0) {
        console.log("Uploading files in parallel...");
        await uploadMultipleFilesToOpenAI(files); // Parallel file upload
      } else {
        console.log('No files to upload.');
      }
    } else {
      console.log('No event logs found.');
    }
  } catch (error) {
    console.error('Error fetching logs:', error);
  }
}

// Function to decode events logs and save them to a file 
async function getEventsLogs(log, _iface) {
  const decodedLog = _iface.parseLog({
    topics: log.topics,
    data: log.data
  });

  const eventContent = formatLogs(log, decodedLog);
  
  // Convert JSON to Blob
  const blob = new Blob([JSON.stringify(eventContent, null, 2)], { type: 'application/json' });
  const fileName = `Event#${++i}.json`; 
  
  console.log(`Event Content prepared for ${fileName}`);
  
  // Push blob and fileName to the files array
  files.push({ blob, fileName });
}

// Function to reformat the retrieved logs
function formatLogs(logs, decodedLog) {
  const logsArray = Array.isArray(logs) ? logs : [logs];
  
  return logsArray.map(log => {

    //Convert timestamp from hex to decimal and then to a human-readable format
    const timestamp = log.timeStamp ? new Date(parseInt(log.timeStamp, 16) * 1000).toISOString() : 'N/A';

    // Create a new object with the formatted log and additional argument data
    const formattedLog = {
      contractAddress: log.address,
      blockNumber: log.blockNumber,
      transactionHash: log.transactionHash,
      timeStamp: timestamp,
      event: {
        name: decodedLog.name,
        arguments: {}
      }
    };

    // Loop through the inputs to add argument names and values
    decodedLog.eventFragment.inputs.forEach((input, index) => {
      formattedLog.event.arguments[input.name] = decodedLog.args[index];
    });

    return formattedLog;
  });
}

// Function to add the new prescription to the blockchain (call smart contract function)
async function addPrescription(condition, medication, dosage) {
  const currentTime = new Date().toISOString();
  const response = await recordsContract.addPrescription(patientAddress, condition, medication, dosage, currentTime);
  while(true) {
    if (response) {
      console.log(response.hash);
      return response.hash;
    }
  } 
}



////////////////////////////// OpenAI Functions //////////////////////////////

// Function to create OpenAI Assistant with file search and function calling tools
async function createAssistant() {
  try {
    const response = await fetch('https://api.openai.com/v1/assistants', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'OpenAI-Beta': 'assistants=v2'
      },
      body: JSON.stringify({
        name: "Clinical Decision Support System Assistant",
        instructions: "You are a Clinical Decision Support System Assistant. You will recieve questions from clinicians regarding patients' issues and conditions. You will generate responses based on the medical records (events from blockchain) attached to you. You have also to detect if there is a possible medical malpractice situation. Make your answers brief and to the point.",
        model: "gpt-4o", 
        tools: [{ type: "file_search" }, 
          { type: "function",
            function: {
              "name": "addPrescription",
              "description": "Add a new prescription for a patient on the blockchain smart contract and return the transaction hash to the user",
              "parameters": {
                  "type": "object",
                  "properties": {
                      "condition": {
                          "type": "string",
                          "description": "Medical condition being treated"
                      },
                      "medication": {
                          "type": "string",
                          "description": "Medication prescribed"
                      },
                      "dosage": {
                          "type": "string",
                          "description": "Dosage of the medication"
                      }
                  },
                  "required": ["condition", "medication", "dosage"]
              }
            }
          }
        ],
        temperature: 0.2
      }),
    });

    // Check if the request was successful
    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }

    // Parse and log the response data
    const data = await response.json();
    assistantId = data.id;
    console.log('Assistant Created:', data);
    console.log('Assistant ID: ', assistantId);
  } catch (error) {
    console.error('Error creating assistant:', error);
  }
}

// Function to create vector store to attach it to the assistant
async function createVectorStore(name) {
  const response = await fetch('https://api.openai.com/v1/vector_stores', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'OpenAI-Beta': 'assistants=v2'
    },
    body: JSON.stringify({ name })
  });

  if (response.ok) {
    const data = await response.json();
    console.log('Vector Store Created:', data);
    console.log('Vector Store ID: ', data.id);
    vectorStoreId = data.id;
  } else {
    console.error('Error creating vector store:', await response.json());
  }
}

// Function to upload a file to OpenAI
async function uploadFileToOpenAI(blob, fileName) {
  const formData = new FormData();
  formData.append('purpose', 'assistants');
  formData.append('file', blob, fileName);

  const response = await fetch('https://api.openai.com/v1/files', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`
    },
    body: formData
  });

  if (response.ok) {
    const data = await response.json();
    console.log('File uploaded:', data);
    return data.id; // Return uploaded file ID
  } else {
    console.error('Error uploading file:', await response.json());
  }
}

// Function to upload multiple files to OpenAI in parallel
async function uploadMultipleFilesToOpenAI(files) {
  try {
    // Use Promise.all to upload files in parallel
    const uploadPromises = files.map(({ blob, fileName }) => uploadFileToOpenAI(blob, fileName));
    
    // Wait for all uploads to complete and get the file IDs
    fileIds = await Promise.all(uploadPromises);
    
    console.log('All files uploaded:', fileIds);

    // Optionally add files to vector store after upload
    if (fileIds.every(id => id !== null)) { // Check if all uploads were successful
      await addFilesToVectorStoreBatch(fileIds);
    } else {
      console.error('Some files failed to upload.');
    }
    
  } catch (error) {
    console.error('Error uploading files in parallel:', error);
  }
}

// Function to add multiple files to the vector store using file_batches endpoint
async function addFilesToVectorStoreBatch(fileIds) {
  const response = await fetch(`https://api.openai.com/v1/vector_stores/${vectorStoreId}/file_batches`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'OpenAI-Beta': 'assistants=v2'
    },
    body: JSON.stringify({
      file_ids: fileIds // Send an array of file IDs
    })
  });

  if (response.ok) {
    const data = await response.json();
    console.log('Files added to vector store batch:', data);
    await updateAssistant(assistantId, vectorStoreId); // Optionally update the assistant if required
  } else {
    console.error('Error adding files to vector store batch:', await response.json());
  }
}

// Function to update the assistant with the vector store ID
async function updateAssistant(assistantId, vectorStoreId) {
  const response = await fetch(`https://api.openai.com/v1/assistants/${assistantId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'OpenAI-Beta': 'assistants=v2'
    },
    body: JSON.stringify({
      tool_resources: { file_search: { vector_store_ids: [vectorStoreId] } }
    })
  });

  if (response.ok) {
    const data = await response.json();
    console.log('Assistant updated:', data);
    await createThread();
  } else {
    console.error('Error updating assistant:', await response.json());
  }
}

// Function to create thread
async function createThread() {
  const url = 'https://api.openai.com/v1/threads';
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'OpenAI-Beta': 'assistants=v2'
      },
      body: JSON.stringify({}) // Sending an empty JSON object
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Request failed: ${errorData.error.message}`);
    }

    const responseData = await response.json();
    console.log('Response:', responseData);
    threadId = responseData.id;
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Function to create user message
async function createMessage(content) {
  const url = `https://api.openai.com/v1/threads/${threadId}/messages`;

  const payload = {
    role: 'user',
    content: content
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Failed to create message: ${errorData.error.message}`);
    }

    const data = await response.json();
    console.log('Message created successfully:', data);
    await createThreadRun();
  } catch (error) {
    console.error('Error creating message:', error.message);
  }
}

// Function to initiate new thread run
async function createThreadRun() {
  const url = `https://api.openai.com/v1/threads/${threadId}/runs`;

  const payload = {
    assistant_id: assistantId
  };

  try {
    const response = await fetch(url, {
      method: 'POST', // Note: The method should be POST
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Failed to create thread run: ${errorData.error.message}`);
    }

    const data = await response.json();
    console.log('Thread run created successfully:', data);
    runId = data.id;
  } catch (error) {
    console.error('Error creating thread run:', error.message);
  }
}

// Function to get the assistant response
async function getMessageResponse() {
  const url = `https://api.openai.com/v1/threads/${threadId}/messages`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2'
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Failed to retrieve messages: ${errorData.error.message}`);
    }

    const responseData = await response.json();
    console.log('Messages retrieved successfully:', responseData);

    return responseData;
  } catch (error) {
    console.error('Error retrieving messages:', error.message);
  }
}

// Function to retrieve the current reun and return the run ID
async function getThreadRun() {
  const url = `https://api.openai.com/v1/threads/${threadId}/runs/${runId}`;

  try {
    const response = await fetch(url, {
      method: 'GET',  // Default is GET, but explicitly mentioning it
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'OpenAI-Beta': 'assistants=v2'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('Response data:', data);
    return data;
  } catch (error) {
    console.error('Error fetching the thread run:', error);
  }
}

// Function to submit outputs to the function calling tool
async function submitToolOutputs(hash, threadId, runId) {
  const url = `https://api.openai.com/v1/threads/${threadId}/runs/${runId}/submit_tool_outputs`;

  const payload = {
    tool_outputs: [
      {
        tool_call_id: callId,
        output: hash
      }
    ]
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('Response data:', data);
    return data;
  } catch (error) {
    console.error('Error submitting tool outputs:', error);
  }
}

///// Functions to delete OpenAI assistat, vector store, and uploaded files
async function deleteAssistant() {
  try {
    const response = await fetch(`https://api.openai.com/v1/assistants/${assistantId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'OpenAI-Beta': 'assistants=v2'
      }
    });

    if (response.ok) {
      console.log('Assistant deleted successfully.');
    } else {
      const errorData = await response.json();
      console.error('Error deleting assistant:', errorData);
    }
  } catch (error) {
    console.error('Fetch error:', error);
  }
}

async function deleteVectorStore() {
  try {
    const response = await fetch(`https://api.openai.com/v1/vector_stores/${vectorStoreId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2'
      }
    });

    if (response.ok) {
      console.log('Vector store deleted successfully.');
    } else {
      const errorData = await response.json();
      console.error('Error deleting vector store:', errorData);
    }
  } catch (error) {
    console.error('Fetch error:', error);
  }
}

async function deleteFile(fileId) {
  const url = `https://api.openai.com/v1/files/${fileId}`;

  try {
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json' // Add Content-Type header
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error(`Error deleting file ${fileId}:`, errorData); // Log the full error response
      throw new Error(`Failed to delete file ${fileId}: ${errorData.error.message}`);
    }

    console.log(`Successfully deleted file ${fileId}`);
  } catch (error) {
    console.error(`Error deleting file ${fileId}:`, error.message);
  }
}

async function deleteMultipleFiles() {
  // Create an array of promises
  const deletePromises = fileIds.map(fileId => deleteFile(fileId));

  try {
    // Execute all promises in parallel
    await Promise.all(deletePromises);
    console.log('All files Deleted.');
    fileIds = [];
    files = [];
  } catch (error) {
    console.error('Error processing some files:', error);
  }
}
