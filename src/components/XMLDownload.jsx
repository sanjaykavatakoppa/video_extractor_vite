import React from 'react';
import { generateXML, downloadXML } from '../utils/videoUtils';
import './XMLDownload.css';

const XMLDownload = ({ videoInfo, userInputs }) => {
  const handleDownload = () => {
    const combinedInfo = {
      ...videoInfo,
      primaryLanguage: userInputs.primaryLanguage,
      countryOrigin: userInputs.countryOrigin,
      cdCategory: userInputs.cdCategory,
      productionTextRef: userInputs.productionTextRef,
      title: userInputs.title,
      description: userInputs.description
    };

    const xmlContent = generateXML(combinedInfo);
    downloadXML(xmlContent, videoInfo.filename);
  };

  const previewXML = () => {
    const combinedInfo = {
      ...videoInfo,
      primaryLanguage: userInputs.primaryLanguage,
      countryOrigin: userInputs.countryOrigin,
      cdCategory: userInputs.cdCategory,
      productionTextRef: userInputs.productionTextRef,
      title: userInputs.title,
      description: userInputs.description
    };

    return generateXML(combinedInfo);
  };

  return (
    <div className="xml-download">
      <div className="xml-header">
        <h3>XML Metadata Export</h3>
        <button onClick={handleDownload} className="download-btn">
          📥 Download XML
        </button>
      </div>
      
      <div className="xml-preview">
        <h4>XML Preview:</h4>
        <pre className="xml-content">
          {previewXML()}
        </pre>
      </div>
    </div>
  );
};

export default XMLDownload;