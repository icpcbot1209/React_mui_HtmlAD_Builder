import React, { useState, useEffect } from 'react';

import { Paper, CircularProgress } from "@material-ui/core";

import * as common from './common';
import * as http from './http';

import { MyTopBar } from './components/MyTopBar';
import { MyCanvas } from './components/MyCanvas';
import { EditTheData } from './components/EditTheData';
import { MyItemList } from './components/MyItemList';
import { EditTheItem } from './components/EditTheItem';
import { MyTemplateTile } from './components/MyTemplateTile';
import { MyFontPicker } from './components/MyFontPicker';
import { MyImagePicker } from './components/MyImagePicker';

const SERVER_INIT = 0;
const SERVER_LOADING = 1;
const SERVER_OK = 2;
const SERVER_ERR = 3;

export default function Main() {
  const [serverStatus, setServerStatus] = useState(SERVER_INIT);

  const [arrS3Font, setArrS3Font] = useState([]);
  const [arrS3Img, setArrS3Img] = useState([]);

  const [theData, setTheData] = useState(null);
  const [idTheItem, setIdTheItem] = useState(null);
  const [arrTemplate, setArrTemplate] = useState([]);

  const [isFontPick, setIsFontPick] = useState(false);
  const [isImgPick, setIsImgPick] = useState(false);

  const [isBusyPdf, setIsBusyPdf] = useState(false);

  useEffect(() => {
    loadAppData();
  }, []);

  const loadAppData = async () => { 
    try {
      setServerStatus(SERVER_LOADING);
      readS3();
      setTheData(common.make_the_data());
      setIdTheItem(0);

      let arrTemplate = await http.readAllTemplate();
      arrTemplate = arrTemplate.filter(tt => tt.id >= 9);

      setArrTemplate(arrTemplate);
      setServerStatus(SERVER_OK);
    } catch (err) {
      console.log(err);
      setServerStatus(SERVER_ERR);
    }
  }

  const readS3 = () => {
    http.readS3().then(resp => {
      let arr = resp.data;
      arr.splice(0, 1);

      let arrS3Font = arr.filter(url => {
        let ext = url.split(".").pop();
        return common.Font_Extensions.includes(ext);
      });

      arrS3Font.forEach(url => {
        let family = common.url2family(url);
        if (!family || family.length === 0) return;
        let junction_font = new FontFace(family, `url(${url})`);
        junction_font
          .load()
          .then((loaded_face) => {
            document.fonts.add(loaded_face);
          })
          .catch((err) => console.log(err));
      });
      setArrS3Font(arrS3Font);


      let arrS3Img = arr.filter(url => {
        let ext = url.split(".").pop();
        return common.Img_Extensions.includes(ext);
      });
      arrS3Img.unshift("none");
      setArrS3Img(arrS3Img);

    }).catch(err => {
      console.log(err);
    });
  };

  const handleNew = () => {
    if (window.confirm("Create New Template? You will lose your current data if not saved.")) { 
      setTheData(common.make_the_data());
    }
  }

  const handleSave = () => {
    if (window.confirm(`Save as "${theData.title}"`)) {
      let adContent = JSON.stringify(theData);
      http.createTempalte(adContent).then(resp => {
      });
    }
  }

  const handleImport = () => {
    const fileSelector = document.createElement('input');
    fileSelector.setAttribute('type', 'file');
    fileSelector.onchange = (e) => {
      if (e.target.files.length === 0) return;
      let file = e.target.files[0];

      const fr = new FileReader();
      fr.onloadend = (event) => {
        let text = event.target.result;
        let theData = common.parseImportedHtmlToJson(text);
        setTheData(theData);
      };
      fr.readAsText(file);
    }
    fileSelector.click();
  }

  const handleExport = () => {
    let exportHtml = common.makeExportHtml(theData);

    exportHtml = exportHtml.replace(/\s{2,}/g, '')   // <-- Replace all consecutive spaces, 2+
      .replace(/%/g, '%25')     // <-- Escape %
      .replace(/&/g, '%26')     // <-- Escape &
      .replace(/#/g, '%23')     // <-- Escape #
      .replace(/"/g, '%22')     // <-- Escape "
      .replace(/'/g, '%27');    // <-- Escape ' (to be 100% safe)

    let dataUrl = "data:text/html," + exportHtml;

    let filename = theData.title + ".html";
    let downloadLink = document.createElement("a");
    document.body.appendChild(downloadLink);

    downloadLink.href = dataUrl;
    downloadLink.download = filename;
    downloadLink.click();
    document.body.removeChild(downloadLink);
  }

  const handleExportPdf = async () => {
    setIsBusyPdf(true);
    let exportHtml = common.makeExportHtml(theData);
    let filename = theData.title + ".html";

    try {
      let blob1 = new Blob(["\ufeff", exportHtml], { type: "text/html" });
      let file = new File([blob1], filename);

      const formData = new FormData();
      formData.append("file", file);

      let resp = await http.makePDF(theData.width, theData.height, formData);


      downloadPdf(resp.data);
    } catch (err) { console.log(err);}

  }


  const downloadPdf = (data) => {
    console.log(data);
    // var blob = new Blob([data], { type: 'application/pdf' });
    // // IE doesn't allow using a blob object directly as link href
    // // instead it is necessary to use msSaveOrOpenBlob
    // if (window.navigator && window.navigator.msSaveOrOpenBlob) {
    //   window.navigator.msSaveOrOpenBlob(blob);
    //   return;
    // }

    // // For other browsers:
    // // Create a link pointing to the ObjectURL containing the blob.
    // const url = window.URL.createObjectURL(blob);
    // var link = document.createElement('a');
    // link.href = url;
    // link.download = theData.title + '.pdf';
    // link.click();
    // setTimeout(function () {
    //   // For Firefox it is necessary to delay revoking the ObjectURL
    //   window.URL.revokeObjectURL(url);
    // }, 100);

    let filename = theData.title + ".pdf";
    let downloadLink = document.createElement("a");
    document.body.appendChild(downloadLink);

    downloadLink.href = data;
    downloadLink.download = filename;
    downloadLink.click();
    document.body.removeChild(downloadLink);
    setIsBusyPdf(false);
  }


  const handleTryData = (data) => { 
    setIdTheItem(null);
    setTheData(data);
  }

  const handleAddItem = (e) => {
    let { width, height, arrItem } = theData;
    let id = 0; arrItem.forEach(item => { if (item.id > id) id = item.id; }); id++;
    
    let newItem;
    if (idTheItem!==null) {
      let theItem = arrItem[idTheItem];
      newItem = JSON.parse(JSON.stringify(theItem));
      newItem.id = id;
      newItem.idStr = `div_${newItem.id}`;
      newItem.style.top = (common.px2num(newItem.style.top) + common.px2num(newItem.style.height)) + 'px';
    } else {
      newItem = common.make_Item_0(id, width, height / 3, width / 10);
    }

    let len = theData.arrItem.length
    setTheData(theData => { 
      return { ...theData, arrItem: [...theData.arrItem, newItem] };
    });

    setIdTheItem(len);
  }

  const handleRemoveItem = (e) => {
    if (idTheItem!==null && window.confirm("Remove this Div?")) {
      let len = theData.arrItem.length;

      setTheData(theData => {
        return { ...theData, arrItem: [...theData.arrItem.slice(0, idTheItem), ...theData.arrItem.slice(idTheItem + 1, len)] };
      });

      setIdTheItem(null);
    }
  }

  const handleChangeTheItem = (newItem) => {
    setTheData(theData => {
      let len = theData.arrItem.length;
      let arrItemNew = [...theData.arrItem.slice(0, idTheItem), newItem, ...theData.arrItem.slice(idTheItem + 1, len)];
      return {...theData, arrItem:arrItemNew};
    });
  }

  const handleSelectItem = (id) => { 
    setIdTheItem(id);
  };


  const StatusView = (status) => { 
    if (status === SERVER_INIT) return null;
    if (status === SERVER_LOADING) return (
      <div style={{display:'flex', alignItems:'center'}}>
        Loading <CircularProgress />
      </div>
    );
    if (status === SERVER_ERR) return (
      <div style={{ display: 'flex', alignItems: 'center', color:'red' }}>
        Server Error!
      </div>
    );
    return null;
  };

  if (!theData) return null;

  return (
    <div style={{ height: "100vh" }}>
      <div style={{ position: 'fixed', top: 0, right: 0, padding:'20px' }} >
        {StatusView(serverStatus)}
      </div>

      <div style={{ height: '100vh', padding: '10px 10px', display: 'flex', flexDirection: 'row',   }}>
        <div style={{ flex: 5, display:'flex', flexDirection:'column' }}>
            <div>
              <Paper elevation={6} style={{ margin: '20px' }}>
                <EditTheData theData={theData} handleChangeTheData={handleTryData} handleSave={handleSave} />
                <div>
                  <MyItemList arrItem={theData.arrItem}
                    idTheItem={idTheItem}
                    handleAddItem={handleAddItem}
                    handleRemoveItem={handleRemoveItem}
                    handleSelectItem={handleSelectItem}
                  />
                </div>
              </Paper>
            </div>
            
            <div style={{
              flex: 1,
              padding: "10px 10px",
              overflowY: "auto",
              overflowX: "auto",
            }}>
              {idTheItem !== null && (
                <EditTheItem
                  theItem={theData.arrItem[idTheItem]}
                  handleChange={handleChangeTheItem}
                  handlePickFont={(tf) => setIsFontPick(tf)}
                  handlePickImg={(tf) => setIsImgPick(tf)}/>
              )}
            </div>

        </div>

        <div style={{ flex: 5, display: 'flex', flexDirection: 'column', backgroundColor: 'lightgrey' }}>
          <div style={{ margin: '20px' }}>
            <MyTopBar handleNew={handleNew} handleSave={handleSave} handleImport={handleImport} handleExport={handleExport} handleExportPdf={handleExportPdf}
              isBusyPdf={isBusyPdf}/>
          </div>
          <div style={{
            flex: 1, margin:'30px',
            overflowY: "auto",
            overflowX: "auto" }}>
            <MyCanvas theData={theData}
              handleChangeTheItem={handleChangeTheItem}
              idTheItem={idTheItem}
              handleSelectItem={handleSelectItem} />
          </div>

        </div>

        <div style={{ flex: 2, display: 'flex', flexDirection: 'column' }}>
          <MyTemplateTile arrTemplate={arrTemplate}
            handleTryData={handleTryData} />
        </div>

        <MyFontPicker isModal={isFontPick} handleToggle={(tf) => { setIsFontPick(tf); }}
          theItem={idTheItem !== null ? theData.arrItem[idTheItem] : null}
          handleChange={handleChangeTheItem}
          arrS3Font={arrS3Font} handleUploadS3={()=>readS3()}/>

        <MyImagePicker isModal={isImgPick} handleToggle={(tf) => { setIsImgPick(tf); }}
          theItem={idTheItem !== null ? theData.arrItem[idTheItem] : null}
          handleChange={handleChangeTheItem}
          arrS3Img={arrS3Img} handleUploadS3={()=>readS3()}/>

      </div>

    </div>
  );
}

