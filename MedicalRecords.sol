//SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "./Registration.sol";

contract MedicalRecords {

    address immutable owner;
    Registration immutable registrationSC;
    uint256 prescriptionId;

    struct Prescription {
        address patient;
        uint256 id;
        bool issued;
    }

    mapping (address=>Prescription[]) prescriptions;

    constructor (address regSCAddr) {
        owner = msg.sender;
        registrationSC = Registration(regSCAddr);
        prescriptionId = 0;
    }

    modifier onlyOwner {
        require(msg.sender==owner, "Only owner can call this function");
        _;
    }

    modifier onlyRegisteredClinicians {
        require(registrationSC.registeredClinicians(msg.sender), "Only registered clinicians can call this function");
        _;
    }

    modifier onlyRegisteredPharmacists {
        require(registrationSC.registeredPharmacists(msg.sender), "Only registered pharmacists can call this function");
        _;
    }

    event PrescriptionAddedByClinician(address indexed patientAddress, uint256 prescriptionId, address clinicianAddress, string condition, string medication, string dosage);
    event SurgeryAdded(address indexed patientAddress, address clinicianAddress, string procedureName);
    event ChronicDiseaseAdded(address indexed patientAddress, address clinicianAddress, string disease, string treatment);
    event LabResultAdded(address indexed patientAddress, address clinicianAddress, string testName, string testResult);
    event PrescriptionDispensedByPharnmacy(address indexed patientAddress, address pharmacistAddress, uint256 prescriptionId, string medication, string amount);
    event PrescriptionRefilledByPharnmacy(address indexed patientAddress, address pharmacistAddress, uint256 prescriptionId, string medication, string amount);

    function addPrescription(address patientAddress, string memory condition, string memory medication, string memory dosage) public onlyRegisteredClinicians {
        require(registrationSC.registeredPatients(patientAddress), "Patient is not registered");
        Prescription memory newPrescription = Prescription({
            patient: patientAddress,
            id: prescriptionId,
            issued: false
        });
        prescriptions[patientAddress].push(newPrescription);
        emit PrescriptionAddedByClinician(patientAddress, prescriptionId, msg.sender, condition, medication, dosage);
        prescriptionId++;
    }

    function addSurgery(address patientAddress, string memory procedureName) public onlyRegisteredClinicians{
        require(registrationSC.registeredPatients(patientAddress), "Patient is not registered");
        emit SurgeryAdded(patientAddress, msg.sender, procedureName);
    }

    function addChronicDisease(address patientAddress, string memory disease, string memory treatment) public onlyRegisteredClinicians {
        require(registrationSC.registeredPatients(patientAddress), "Patient is not registered");        
        emit ChronicDiseaseAdded(patientAddress, msg.sender, disease, treatment);
    }

    function addLabResult(address patientAddress, string memory testName, string memory testResult) public onlyRegisteredClinicians {
        require(registrationSC.registeredPatients(patientAddress), "Patient is not registered");
        emit LabResultAdded(patientAddress, msg.sender, testName, testResult);
    }

    function dispensePrescription(address patientAddress, uint256 prescId, string memory medication, string memory amount) public onlyRegisteredPharmacists {
        require(registrationSC.registeredPatients(patientAddress), "Patient is not registered");
        require(!prescriptions[patientAddress][prescId].issued, "Prescription is already issued");
        prescriptions[patientAddress][prescId].issued = true;
        emit PrescriptionDispensedByPharnmacy(patientAddress, msg.sender, prescId, medication, amount);
    }

    function refillPrescription(address patientAddress, uint256 prescId, string memory medication, string memory amount) public onlyRegisteredPharmacists {
        require(registrationSC.registeredPatients(patientAddress), "Patient is not registered");
        require(prescriptions[patientAddress][prescId].issued, "Prescription is not issued before");
        emit PrescriptionDispensedByPharnmacy(patientAddress, msg.sender, prescId, medication, amount);
    }

}