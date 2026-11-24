use chrono::{DateTime, SecondsFormat, Utc};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tempfile::NamedTempFile;
use uuid::Uuid;

pub const MAX_AMOUNT_CENTS: i64 = 999_999_999;

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Person {
    pub id: String,
    pub name: String,
    pub created_at: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Share {
    pub person_id: String,
    pub amount_cents: i64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Activity {
    pub id: String,
    pub name: String,
    pub created_at: String,
    pub mode: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub total_cents: Option<i64>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub participant_ids: Vec<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub shares: Vec<Share>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub schema_version: u8,
    pub id: String,
    pub name: String,
    pub created_at: String,
    pub updated_at: String,
    pub people: Vec<Person>,
    pub activities: Vec<Activity>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSummary {
    pub id: String,
    pub name: String,
    pub updated_at: String,
    pub people_count: usize,
    pub activity_count: usize,
    pub total_cents: i64,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct LoadProjectResult {
    pub project: Project,
    pub recovered_from_backup: bool,
}

pub struct Store {
    data_dir: PathBuf,
    mtimes: Mutex<HashMap<String, u64>>,
    unreadable: Mutex<HashSet<String>>,
}

impl Store {
    pub fn new(data_dir: PathBuf) -> Self {
        Self {
            data_dir,
            mtimes: Mutex::new(HashMap::new()),
            unreadable: Mutex::new(HashSet::new()),
        }
    }

    pub fn data_dir(&self) -> &Path {
        &self.data_dir
    }

    fn ensure_dir(&self) -> Result<(), String> {
        fs::create_dir_all(&self.data_dir).map_err(|error| format!("无法创建数据文件夹：{error}"))
    }

    fn validate_id(id: &str) -> Result<(), String> {
        Uuid::parse_str(id)
            .map(|_| ())
            .map_err(|_| "项目 ID 无效".to_string())
    }

    fn project_path(&self, id: &str) -> Result<PathBuf, String> {
        Self::validate_id(id)?;
        Ok(self.data_dir.join(format!("{id}.json")))
    }

    fn backup_path(&self, id: &str) -> Result<PathBuf, String> {
        Self::validate_id(id)?;
        Ok(self.data_dir.join(format!("{id}.bak.json")))
    }

    fn now() -> String {
        Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true)
    }

    fn milliseconds(time: SystemTime) -> u64 {
        time.duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64
    }

    fn iso_from_time(time: SystemTime) -> String {
        let date: DateTime<Utc> = time.into();
        date.to_rfc3339_opts(SecondsFormat::Millis, true)
    }

    fn normalize_name(raw: &str) -> String {
        raw.split_whitespace().collect::<Vec<_>>().join(" ")
    }

    fn name_key(raw: &str) -> String {
        Self::normalize_name(raw).to_lowercase()
    }

    fn validate_project(project: &Project) -> Result<(), String> {
        if project.schema_version != 1 {
            return Err("项目数据版本无效".to_string());
        }
        Self::validate_id(&project.id)?;

        let project_name = Self::normalize_name(&project.name);
        if project_name.is_empty() || project_name.chars().count() > 40 {
            return Err("项目名称无效".to_string());
        }

        let mut person_ids = HashSet::new();
        let mut person_names = HashSet::new();
        for person in &project.people {
            if person.id.is_empty() || !person_ids.insert(person.id.clone()) {
                return Err("人员 ID 无效".to_string());
            }
            let name = Self::normalize_name(&person.name);
            if name.is_empty() || name.chars().count() > 20 {
                return Err("人员名称无效".to_string());
            }
            if !person_names.insert(Self::name_key(&name)) {
                return Err("人员名称重复".to_string());
            }
        }

        let mut activity_ids = HashSet::new();
        for activity in &project.activities {
            if activity.id.is_empty() || !activity_ids.insert(activity.id.clone()) {
                return Err("活动 ID 无效".to_string());
            }
            let name = Self::normalize_name(&activity.name);
            if name.is_empty() || name.chars().count() > 40 {
                return Err("活动名称无效".to_string());
            }

            if activity.mode == "equal" {
                let total = activity
                    .total_cents
                    .ok_or_else(|| "均摊活动缺少总额".to_string())?;
                if total <= 0 || total > MAX_AMOUNT_CENTS {
                    return Err("活动总额无效".to_string());
                }
                if activity.participant_ids.is_empty() {
                    return Err("活动至少需要一名参与人员".to_string());
                }
                let mut participants = HashSet::new();
                for person_id in &activity.participant_ids {
                    if !person_ids.contains(person_id) {
                        return Err("活动包含不存在的人员".to_string());
                    }
                    if !participants.insert(person_id) {
                        return Err("活动人员重复".to_string());
                    }
                }
            } else if activity.mode == "custom" {
                if activity.shares.is_empty() {
                    return Err("独立输入活动缺少金额".to_string());
                }
                let mut people = HashSet::new();
                let mut positive = false;
                for share in &activity.shares {
                    if !person_ids.contains(&share.person_id) {
                        return Err("活动包含不存在的人员".to_string());
                    }
                    if !people.insert(&share.person_id) {
                        return Err("活动人员重复".to_string());
                    }
                    if share.amount_cents < 0 || share.amount_cents > MAX_AMOUNT_CENTS {
                        return Err("活动金额无效".to_string());
                    }
                    if share.amount_cents > 0 {
                        positive = true;
                    }
                }
                if !positive {
                    return Err("独立输入活动至少需要一笔大于 0 的金额".to_string());
                }
            } else {
                return Err("活动分摊方式无效".to_string());
            }
        }

        Ok(())
    }

    fn read_project(path: &Path) -> Result<Project, String> {
        let raw = fs::read_to_string(path).map_err(|error| format!("读取项目失败：{error}"))?;
        let project: Project =
            serde_json::from_str(&raw).map_err(|_| "项目数据无效".to_string())?;
        Self::validate_project(&project)?;
        Ok(project)
    }

    fn summary(project: &Project) -> ProjectSummary {
        let total_cents = project
            .activities
            .iter()
            .map(|activity| {
                if activity.mode == "equal" {
                    activity.total_cents.unwrap_or(0)
                } else {
                    activity.shares.iter().map(|share| share.amount_cents).sum()
                }
            })
            .sum();

        ProjectSummary {
            id: project.id.clone(),
            name: project.name.clone(),
            updated_at: project.updated_at.clone(),
            people_count: project.people.len(),
            activity_count: project.activities.len(),
            total_cents,
            status: "ok".to_string(),
            error: None,
        }
    }

    pub fn list(&self) -> Result<Vec<ProjectSummary>, String> {
        self.ensure_dir()?;
        let entries =
            fs::read_dir(&self.data_dir).map_err(|error| format!("读取数据文件夹失败：{error}"))?;
        let mut summaries = Vec::new();

        for entry in entries {
            let entry = entry.map_err(|error| format!("读取数据文件夹失败：{error}"))?;
            let path = entry.path();
            if !path.is_file() {
                continue;
            }
            let Some(file_name) = path.file_name().and_then(|value| value.to_str()) else {
                continue;
            };
            if !file_name.ends_with(".json") || file_name.ends_with(".bak.json") {
                continue;
            }
            let id = file_name.trim_end_matches(".json");
            if Uuid::parse_str(id).is_err() {
                continue;
            }

            match Self::read_project(&path) {
                Ok(project) => summaries.push(Self::summary(&project)),
                Err(_) => {
                    let updated_at = fs::metadata(&path)
                        .and_then(|metadata| metadata.modified())
                        .map(Self::iso_from_time)
                        .unwrap_or_else(|_| Self::now());
                    summaries.push(ProjectSummary {
                        id: id.to_string(),
                        name: id.to_string(),
                        updated_at,
                        people_count: 0,
                        activity_count: 0,
                        total_cents: 0,
                        status: "unreadable".to_string(),
                        error: Some("项目文件无法读取".to_string()),
                    });
                }
            }
        }

        summaries.sort_by(|left, right| right.updated_at.cmp(&left.updated_at));
        Ok(summaries)
    }

    pub fn create(&self, name: &str) -> Result<Project, String> {
        let name = Self::normalize_name(name);
        if name.is_empty() || name.chars().count() > 40 {
            return Err("项目名称无效".to_string());
        }
        self.ensure_dir()?;
        let exist = self.list()?.iter().any(|summary| {
            summary.status == "ok" && Self::name_key(&summary.name) == Self::name_key(&name)
        });
        if exist {
            return Err("项目名称已存在".to_string());
        }

        let timestamp = Self::now();
        let project = Project {
            schema_version: 1,
            id: Uuid::new_v4().to_string(),
            name,
            created_at: timestamp.clone(),
            updated_at: timestamp,
            people: Vec::new(),
            activities: Vec::new(),
        };
        self.save(project)
    }

    pub fn load(&self, id: &str) -> Result<LoadProjectResult, String> {
        self.ensure_dir()?;
        let main_path = self.project_path(id)?;
        match Self::read_project(&main_path) {
            Ok(project) => {
                if let Ok(metadata) = fs::metadata(&main_path) {
                    if let Ok(modified) = metadata.modified() {
                        self.mtimes
                            .lock()
                            .map_err(|_| "状态锁定失败".to_string())?
                            .insert(id.to_string(), Self::milliseconds(modified));
                    }
                }
                self.unreadable
                    .lock()
                    .map_err(|_| "状态锁定失败".to_string())?
                    .remove(id);
                Ok(LoadProjectResult {
                    project,
                    recovered_from_backup: false,
                })
            }
            Err(main_error) => {
                let backup_path = self.backup_path(id)?;
                match Self::read_project(&backup_path) {
                    Ok(project) => {
                        self.unreadable
                            .lock()
                            .map_err(|_| "状态锁定失败".to_string())?
                            .insert(id.to_string());
                        if let Ok(metadata) = fs::metadata(&main_path) {
                            if let Ok(modified) = metadata.modified() {
                                self.mtimes
                                    .lock()
                                    .map_err(|_| "状态锁定失败".to_string())?
                                    .insert(id.to_string(), Self::milliseconds(modified));
                            }
                        }
                        Ok(LoadProjectResult {
                            project,
                            recovered_from_backup: true,
                        })
                    }
                    Err(_) => {
                        if main_error.contains("读取项目失败") && !main_path.exists() {
                            Err("项目不存在".to_string())
                        } else {
                            Err("项目文件无法读取".to_string())
                        }
                    }
                }
            }
        }
    }

    pub fn save(&self, mut project: Project) -> Result<Project, String> {
        project.name = Self::normalize_name(&project.name);
        Self::validate_project(&project)?;
        self.ensure_dir()?;

        let exist = self.list()?.iter().any(|summary| {
            summary.status == "ok"
                && summary.id != project.id
                && Self::name_key(&summary.name) == Self::name_key(&project.name)
        });
        if exist {
            return Err("项目名称已存在".to_string());
        }

        let target_path = self.project_path(&project.id)?;
        let backup_path = self.backup_path(&project.id)?;
        let existing = fs::metadata(&target_path).ok();

        if let Some(metadata) = &existing {
            if let Ok(modified) = metadata.modified() {
                let mtimes = self.mtimes.lock().map_err(|_| "状态锁定失败".to_string())?;
                if let Some(known) = mtimes.get(&project.id) {
                    if Self::milliseconds(modified).abs_diff(*known) > 1 {
                        return Err(
                            "项目文件已被外部修改，请返回历史重新打开后再保存。".to_string()
                        );
                    }
                }
            }
        }

        let repairing_unreadable = self
            .unreadable
            .lock()
            .map_err(|_| "状态锁定失败".to_string())?
            .contains(&project.id);

        if existing.is_some() && !repairing_unreadable {
            fs::copy(&target_path, &backup_path)
                .map_err(|error| format!("保存备份失败：{error}"))?;
        }

        project.updated_at = Self::now();
        let json = serde_json::to_string_pretty(&project)
            .map_err(|error| format!("序列化项目失败：{error}"))?;
        self.atomic_write(&target_path, &json)?;

        if let Ok(metadata) = fs::metadata(&target_path) {
            if let Ok(modified) = metadata.modified() {
                self.mtimes
                    .lock()
                    .map_err(|_| "状态锁定失败".to_string())?
                    .insert(project.id.clone(), Self::milliseconds(modified));
            }
        }
        self.unreadable
            .lock()
            .map_err(|_| "状态锁定失败".to_string())?
            .remove(&project.id);

        Ok(project)
    }

    pub fn remove(&self, id: &str) -> Result<(), String> {
        self.ensure_dir()?;
        for path in [self.project_path(id)?, self.backup_path(id)?] {
            if path.exists() {
                trash::delete(&path).map_err(|error| format!("无法移入回收站：{error}"))?;
            }
        }
        self.mtimes
            .lock()
            .map_err(|_| "状态锁定失败".to_string())?
            .remove(id);
        self.unreadable
            .lock()
            .map_err(|_| "状态锁定失败".to_string())?
            .remove(id);
        Ok(())
    }

    pub fn open_folder(&self) -> Result<(), String> {
        self.ensure_dir()?;
        open::that(self.data_dir()).map_err(|error| format!("无法打开数据文件夹：{error}"))
    }

    fn atomic_write(&self, target: &Path, contents: &str) -> Result<(), String> {
        let mut temporary =
            NamedTempFile::new_in(&self.data_dir).map_err(|error| format!("保存失败：{error}"))?;
        temporary
            .write_all(contents.as_bytes())
            .map_err(|error| format!("保存失败：{error}"))?;
        temporary
            .flush()
            .map_err(|error| format!("保存失败：{error}"))?;
        temporary
            .persist(target)
            .map_err(|error| format!("保存失败：{}", error.error))?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    fn test_store() -> (Store, tempfile::TempDir) {
        let directory = tempdir().expect("temp dir");
        let store = Store::new(directory.path().to_path_buf());
        (store, directory)
    }

    #[test]
    fn creates_lists_and_loads_a_project() {
        let (store, _directory) = test_store();
        let project = store.create("云南行").expect("create");
        assert_eq!(project.name, "云南行");
        let summaries = store.list().expect("list");
        assert_eq!(summaries.len(), 1);
        assert_eq!(summaries[0].status, "ok");
        let loaded = store.load(&project.id).expect("load");
        assert!(!loaded.recovered_from_backup);
        assert_eq!(loaded.project.id, project.id);
    }

    #[test]
    fn rejects_duplicate_names() {
        let (store, _directory) = test_store();
        store.create("云南行").expect("create");
        assert!(store.create(" 云南行 ").is_err());
    }

    #[test]
    fn recovers_from_backup_when_main_is_corrupt() {
        let (store, _directory) = test_store();
        let project = store.create("云南行").expect("create");
        let mut changed = project.clone();
        changed.name = "云南新行".to_string();
        store.save(changed).expect("save");
        let main = store.project_path(&project.id).expect("path");
        fs::write(&main, "{broken").expect("corrupt");
        let loaded = store.load(&project.id).expect("recover");
        assert!(loaded.recovered_from_backup);
        assert_eq!(loaded.project.name, "云南行");
    }

    #[test]
    fn saves_people_and_activities() {
        let (store, _directory) = test_store();
        let mut project = store.create("云南行").expect("create");
        project.people.push(Person {
            id: Uuid::new_v4().to_string(),
            name: "小明".to_string(),
            created_at: Store::now(),
        });
        project.activities.push(Activity {
            id: Uuid::new_v4().to_string(),
            name: "住宿".to_string(),
            created_at: Store::now(),
            mode: "equal".to_string(),
            total_cents: Some(60000),
            participant_ids: vec![project.people[0].id.clone()],
            shares: Vec::new(),
        });
        let saved = store.save(project).expect("save");
        let loaded = store.load(&saved.id).expect("load");
        assert_eq!(loaded.project.people.len(), 1);
        assert_eq!(loaded.project.activities.len(), 1);
    }
}
