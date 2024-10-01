//SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

contract Registration {

    address immutable owner;

    constructor () {
        owner = msg.sender;
    }

    modifier onlyOwner {
        require(msg.sender==owner, "Only owner can call this function");
        _;
    }

    mapping (address=>bool) public registeredPatients;
    mapping (address=>bool) public registeredClinicians;
    mapping (address=>bool) public registeredPharmacists;

    event PatientRegistered(address indexed patientAddress, string patientID, string gender, string birthDate);
    event ClinicianRegistered(address indexed clinicianAddress, string clinicianID, string hospital);
    event PharmacistRegistered(address indexed pharmacistAddress, string pharmacistID, string pharmacy);

    function registerPatient(address patientAddress, string memory id, string memory gender, string memory birthDate) public onlyOwner{
        require(!registeredPatients[patientAddress], "Patient is already registered");
        registeredPatients[patientAddress] = true;
        emit PatientRegistered(patientAddress, id, gender, birthDate);
    }

    function registerClinician(address clinicianAddress, string memory id, string memory hospital) public onlyOwner{
        require(!registeredClinicians[clinicianAddress], "Clinician is already registered");
        registeredClinicians[clinicianAddress] = true;
        emit ClinicianRegistered(clinicianAddress, id, hospital);
    }

    function registerPharmacist(address pharmacistAddress, string memory id, string memory pharmacy) public onlyOwner{
        require(!registeredPharmacists[pharmacistAddress], "Pharmacist is already registered");
        registeredPharmacists[pharmacistAddress] = true;
        emit PharmacistRegistered(pharmacistAddress, id, pharmacy);
    }

    function isPatientRegistered(address patientAddress) public view returns (bool) {
        return registeredPatients[patientAddress];
    }

    function isClinicianRegistered() public view returns (bool) {
        if (registeredClinicians[msg.sender] || registeredPharmacists[msg.sender]) {
            return true;
        }
        else {
            return false;
        } 
    }

}