//SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "./Registration.sol";

contract MedicalRecords {

    address immutable owner;
    Registration immutable registrationSC;
    uint256 prescriptionId;

    struct Prescription {
        address clinician;
        string condition;
        string medication;
        string dosage;
        uint256 startDate;
        uint256 id;
        bool dispensed;
    }

    struct Surgery {
        address clinician;
        string procedureName;
        uint256 date;
    }

    struct LabResult {
        address clinician;
        string testName;
        string testResult;
        uint256 date;
    }

    struct ChronicDisease {
        address clinician;
        string disease;
        string treatment;
        uint256 date;
    }

    struct PatientRecords {
        Prescription[] prescriptions;
        Surgery[] surgeries;
        ChronicDisease[] chronicDiseases;
        LabResult[] labResults;
    }

    mapping (address=>PatientRecords) patientsRecords;

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

    function addPrescription(address patientAddress, string memory condition, string memory medication, string memory dosage) public onlyRegisteredClinicians{
        require(registrationSC.registeredPatients(patientAddress), "Patient is not registered");
        patientsRecords[patientAddress].prescriptions.push(Prescription({
            clinician: msg.sender,
            condition: condition,
            medication: medication,
            dosage: dosage,
            startDate: block.timestamp,
            id: prescriptionId,
            dispensed: false
        }));
        emit PrescriptionAddedByClinician(patientAddress, prescriptionId, msg.sender, condition, medication, dosage);
        prescriptionId++;
    }

    function addSurgery(address patientAddress, string memory procedureName) public onlyRegisteredClinicians{
        require(registrationSC.registeredPatients(patientAddress), "Patient is not registered");
        patientsRecords[patientAddress].surgeries.push(Surgery({
            clinician: msg.sender,
            procedureName: procedureName,
            date: block.timestamp
        }));
        emit SurgeryAdded(patientAddress, msg.sender, procedureName);
    }

    function addChronicDisease(address patientAddress, string memory disease, string memory treatment) public onlyRegisteredClinicians{
        require(registrationSC.registeredPatients(patientAddress), "Patient is not registered");        
        patientsRecords[patientAddress].chronicDiseases.push(ChronicDisease({
            clinician: msg.sender,
            disease: disease,
            treatment: treatment,
            date: block.timestamp
        }));
        emit ChronicDiseaseAdded(patientAddress, msg.sender, disease, treatment);
    }

    function addLabResult(address patientAddress, string memory testName, string memory testResult) public onlyRegisteredClinicians {
        require(registrationSC.registeredPatients(patientAddress), "Patient is not registered");
        patientsRecords[patientAddress].labResults.push(LabResult({
            clinician: msg.sender,
            testName: testName,
            testResult: testResult,
            date: block.timestamp
        }));
        emit LabResultAdded(patientAddress, msg.sender, testName, testResult);
    }

    function dispensePrescription(address patientAddress, uint256 prescId, string memory medication, string memory amount) public onlyRegisteredPharmacists {
        require(registrationSC.registeredPatients(patientAddress), "Patient is not registered");
        require(!patientsRecords[patientAddress].prescriptions[prescId].dispensed, "Prescription is already dispensed");
        patientsRecords[patientAddress].prescriptions[prescId].dispensed = true;
        emit PrescriptionDispensedByPharnmacy(patientAddress, msg.sender, prescId, medication, amount);
    }

    function refillPrescription(address patientAddress, uint256 prescId, string memory medication, string memory amount) public onlyRegisteredPharmacists {
        require(registrationSC.registeredPatients(patientAddress), "Patient is not registered");
        require(patientsRecords[patientAddress].prescriptions[prescId].dispensed, "Prescription is not dispensed before");
        emit PrescriptionDispensedByPharnmacy(patientAddress, msg.sender, prescId, medication, amount);
    }

}
